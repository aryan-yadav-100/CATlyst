import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  saveLocalExam,
  getLocalExam,
  upsertLocalResponse,
  getLocalResponses,
  getDirtyResponses,
  markResponsesSyncedUpTo,
  saveLocalViolation,
  getDirtyViolations,
  markViolationsSynced,
  clearAttemptData,
  type LocalExam,
  type LocalResponse,
  type CachedQuestion,
  type CachedQuestionSet,
} from '@/lib/examDB';

import {
  enterSection,
  syncAttempt,
  submitSection,
  ApiError,
  type SyncResponseItem,
  type SyncViolationItem,
} from '@/lib/api';

import type { Section, ViolationType } from '@/types';

export type EnginePhase =
  | 'loading'
  | 'not_started'
  | 'awaiting_start'
  | 'running'
  | 'submitting'
  | 'transition'
  | 'session_conflict'
  | 'finished'
  | 'error';

/**
 * How often a background sync fires WHILE something is dirty. An idle
 * student (nothing changed since the last sync) costs nothing --
 * this interval only ever fires a request when there is something to
 * send. 60s is the default; the final answers travel inside
 * submit_section either way, so this interval mainly protects against
 * losing progress to a crash/closed-tab mid-section.
 */
const SYNC_INTERVAL_MS = 60_000;

interface UseExamEngineOptions {
  mockId: string;
  onSubmitted: (attemptId: string) => void;
}

interface UseExamEngineReturn {
  phase: EnginePhase;
  currentSection: Section | null;
  questionSets: CachedQuestionSet[];
  questions: CachedQuestion[];
  responses: Record<string, LocalResponse>;
  remainingSeconds: number;
  isWarning: boolean;
  error: string | null;
  isSyncing: boolean;
  pendingCount: number;
  /** Call from the transition screen's "Start <Section>" button, and
   * from the initial "Start Test" button. Never call this automatically
   * on mount/refresh -- that is exactly the bug that let a refresh
   * silently start the next section's timer. */
  start: () => Promise<void>;
  setAnswer: (questionId: string, answer: string | null) => void;
  toggleReview: (questionId: string) => void;
  markVisited: (questionId: string) => void;
  addTimeSpent: (questionId: string, seconds: number) => void;
  recordViolation: (type: ViolationType) => void;
}

export function useExamEngine({ mockId, onSubmitted }: UseExamEngineOptions): UseExamEngineReturn {
  const [phase, setPhase] = useState<EnginePhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<LocalExam | null>(null);
  const [responses, setResponses] = useState<Record<string, LocalResponse>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  /*
   * Refs mirror committed state for the async callbacks (timer tick,
   * sync interval, beforeunload) that must always read the LATEST
   * values rather than whatever was current when the effect first
   * ran. This is what fixes the old stale-closure bug where an
   * auto-submit fired using the responses/section from section load
   * time, silently reverting anything answered afterwards.
   */
  const examRef = useRef<LocalExam | null>(null);
  const serverOffsetRef = useRef(0);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const submittingRef = useRef(false);

  examRef.current = exam;

  const updatePendingCount = useCallback(async (attemptId: string) => {
    const [dirtyResponses, dirtyViolations] = await Promise.all([
      getDirtyResponses(attemptId),
      getDirtyViolations(attemptId),
    ]);
    setPendingCount(dirtyResponses.length + dirtyViolations.length);
  }, []);

  /* ---- errors -------------------------------------------------- */

  const handleApiError = useCallback((err: unknown, reloadOnReconcile = true) => {
    if (err instanceof ApiError) {
      if (err.code === 'SESSION_REPLACED') {
        // A genuinely different tab/device now owns this section.
        setPhase('session_conflict');
        return;
      }

      if (err.code === 'SESSION_ENDED' || err.code === 'SECTION_EXPIRED' || err.code === 'ALREADY_SUBMITTED') {
        // NOT a real error: the server's state moved on for a
        // legitimate reason (this session's own submit already landed
        // but the response never reached this client, or the section
        // was lazily finalized by someone else touching it). Reconcile
        // by asking the server what's true now instead of latching a
        // permanent error screen -- this is the fix for the reproduced
        // "Something went wrong / Session conflict" dead end.
        if (reloadOnReconcile) {
          void loadSection(false); // eslint-disable-line @typescript-eslint/no-use-before-define
        }
        return;
      }
    }

    setError(err instanceof Error ? err.message : 'Something went wrong');
    setPhase('error');
  }, []);

  /* ---- load / enter a section ------------------------------------ */

  const loadSection = useCallback(
    async (start: boolean) => {
      try {
        const result = await enterSection(mockId, start);

        if (result.phase === 'not_started') {
          setPhase('not_started');
          return;
        }

        if (result.phase === 'submitted') {
          setPhase('finished');
          if (result.attempt_id) onSubmitted(result.attempt_id);
          return;
        }

        if (result.phase === 'awaiting_start') {
          setPhase('awaiting_start');
          return;
        }

        // phase === 'running'
        const nowMs = Date.now();
        const serverNowMs = result.server_now ? new Date(result.server_now).getTime() : nowMs;
        serverOffsetRef.current = serverNowMs - nowMs;

        const attemptId = result.attempt_id!;

        const localExam: LocalExam = {
          attemptId,
          mockId,
          section: result.current_section!,
          sessionId: result.session_id!,
          tabId: result.tab_id!,
          sectionStartedAt: result.section_started_at!,
          sectionEndsAt: result.section_ends_at!,
          serverOffsetMs: serverOffsetRef.current,
          loadedAt: new Date().toISOString(),
          stateVersion: result.state_version ?? 1,
          questionSets: (result.question_sets ?? []) as CachedQuestionSet[],
          questions: (result.questions ?? []) as CachedQuestion[],
        };

        await saveLocalExam(localExam);

        // Merge server responses with anything already stored locally
        // -- a locally dirty (not-yet-synced) edit always wins, so a
        // refresh can never revert an answer that hasn't reached the
        // server yet.
        const localResponses = await getLocalResponses(attemptId);
        const localByQuestion = new Map(localResponses.map((r) => [r.questionId, r]));

        for (const serverResponse of result.responses ?? []) {
          const local = localByQuestion.get(serverResponse.question_id);
          const isLocalDirty = !!local && local.clientSeq > local.syncedSeq;
          if (isLocalDirty) continue;

          await upsertLocalResponse(attemptId, serverResponse.question_id, {
            selectedAnswer: serverResponse.selected_answer,
            isMarkedForReview: serverResponse.is_marked_for_review,
            isVisited: serverResponse.is_visited,
            timeSpentSeconds: serverResponse.time_spent_seconds,
          });

          // This came FROM the server -- mark it synced at that seq so
          // it doesn't immediately show up as dirty again.
          await markResponsesSyncedUpTo(attemptId, {
            [serverResponse.question_id]: serverResponse.client_seq,
          });
        }

        const merged = await getLocalResponses(attemptId);
        setResponses(Object.fromEntries(merged.map((r) => [r.questionId, r])));
        await updatePendingCount(attemptId);

        setExam(localExam);
        setError(null);
        setPhase('running');
      } catch (err) {
        handleApiError(err);
      }
    },
    [mockId, onSubmitted, updatePendingCount, handleApiError]
  );

  useEffect(() => {
    void loadSection(false);
    // Mount-only: TestInterface remounts per mock via route change, so
    // this does not need to re-run on identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    setPhase('loading');
    await loadSection(true);
  }, [loadSection]);

  /* ---- sync -------------------------------------------------------- */

  const buildBatch = useCallback(async (attemptId: string) => {
    const [dirtyResponses, dirtyViolations] = await Promise.all([
      getDirtyResponses(attemptId),
      getDirtyViolations(attemptId),
    ]);

    const responseItems: SyncResponseItem[] = dirtyResponses.map((r) => ({
      question_id: r.questionId,
      selected_answer: r.selectedAnswer,
      is_marked_for_review: r.isMarkedForReview,
      is_visited: r.isVisited,
      time_spent_seconds: r.timeSpentSeconds,
      client_seq: r.clientSeq,
    }));

    const violationItems: SyncViolationItem[] = dirtyViolations.map((v) => ({
      client_id: v.id,
      type: v.type,
      section: v.section,
      occurred_at: v.occurredAt,
    }));

    return { responseItems, violationItems, dirtyResponses, dirtyViolations };
  }, []);

  const runSync = useCallback(async () => {
    const current = examRef.current;
    if (!current || submittingRef.current) return;

    const { responseItems, violationItems, dirtyResponses, dirtyViolations } = await buildBatch(
      current.attemptId
    );

    if (responseItems.length === 0 && violationItems.length === 0) return;

    try {
      const result = await syncAttempt(current.attemptId, current.sessionId, responseItems, violationItems);

      const sentSeqByQuestion: Record<string, number> = {};
      for (const r of dirtyResponses) sentSeqByQuestion[r.questionId] = r.clientSeq;
      await markResponsesSyncedUpTo(current.attemptId, sentSeqByQuestion);

      if (dirtyViolations.length > 0) {
        await markViolationsSynced(dirtyViolations.map((v) => v.id));
      }

      // Refresh the clock offset opportunistically -- free, since it
      // rides on a call already being made.
      if (result.server_now) {
        serverOffsetRef.current = new Date(result.server_now).getTime() - Date.now();
      }

      await updatePendingCount(current.attemptId);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'SESSION_REPLACED') {
          setPhase('session_conflict');
          return;
        }

        if (err.code === 'SECTION_EXPIRED' || err.code === 'SESSION_ENDED') {
          // The server already closed this section out from under a
          // stale periodic sync (ordinary clock drift between client
          // and server, or a sync that raced the local timer by a
          // few hundred ms). Finalize right away instead of waiting
          // for the next 1s tick -- this also stops the interval from
          // repeatedly hitting the same already-closed section every
          // cycle, which is what produced the repeated 400s.
          if (!submittingRef.current) {
            void doSubmit(); // eslint-disable-line @typescript-eslint/no-use-before-define
          }
          return;
        }

        if (err.code === 'ALREADY_SUBMITTED') {
          // The whole attempt (not just this section) is already
          // done. Reload to pick up the 'submitted' phase and
          // navigate to results.
          void loadSection(false);
          return;
        }
      }
      // Any other failure: leave everything dirty, retried on the
      // next interval, on reconnect, or folded into the final submit.
    }
  }, [buildBatch, updatePendingCount]);

  /** Coalesces concurrent callers onto one in-flight request instead
   * of one failing outright because another sync was already running
   * (the old bug where clicking submit during the 30s auto-sync threw
   * "could not be synchronized"). */
  const syncNow = useCallback((): Promise<void> => {
    if (syncInFlightRef.current) return syncInFlightRef.current;

    const promise = (async () => {
      setIsSyncing(true);
      try {
        await runSync();
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = promise;
    return promise;
  }, [runSync]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      void syncNow();
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [phase, syncNow]);

  useEffect(() => {
    // Only reconnect (coming back online) forces an immediate sync.
    // A tab-hide/visibility change deliberately does NOT trigger one:
    // TestInterface records a tab_switch violation on every hide,
    // which would make the batch non-empty every single time and
    // guarantee a request on every tab switch regardless of whether
    // anything else changed. That violation is still captured locally
    // right away -- it just rides along with the next scheduled sync
    // (or the final submit_section batch) instead of forcing its own
    // round trip. Nothing is lost, it's just not sent immediately.
    const onOnline = () => void syncNow();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncNow]);

  useEffect(() => {
    // beforeunload is a genuine best-effort last save on actual tab
    // close/navigation-away -- unlike visibilitychange, it does NOT
    // fire on ordinary tab switching, so it costs nothing in the
    // common case.
    const handler = () => void syncNow();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [syncNow]);

  /* ---- timer + auto-submit ------------------------------------------ */

  const doSubmit = useCallback(async () => {
    const current = examRef.current;
    if (!current || submittingRef.current) return;

    submittingRef.current = true;
    setPhase('submitting');

    try {
      // Don't race the final batch against a sync already in flight.
      if (syncInFlightRef.current) await syncInFlightRef.current;

      const { responseItems, violationItems } = await buildBatch(current.attemptId);
      const result = await submitSection(current.attemptId, current.sessionId, responseItems, violationItems);

      await clearAttemptData(current.attemptId).catch(() => {
        // Best-effort local cleanup only -- the server-side result is
        // already authoritative regardless of whether this succeeds.
      });

      submittingRef.current = false;

      if (result.submitted) {
        setPhase('finished');
        onSubmitted(result.attempt_id);
        return;
      }

      // Advanced to the next section. Deliberately does NOT call
      // enterSection(start=true) here -- the next section only starts
      // when the student acts on the transition screen, matching
      // "submit-section does not start the next section."
      setPhase('transition');
    } catch (err) {
      submittingRef.current = false;
      handleApiError(err);
    }
  }, [buildBatch, handleApiError, onSubmitted]);

  useEffect(() => {
    if (phase !== 'running' || !exam) return;

    const tick = () => {
      const current = examRef.current;
      if (!current) return;

      const nowEstimate = Date.now() + serverOffsetRef.current;
      const endsAtMs = new Date(current.sectionEndsAt).getTime();
      const remaining = Math.max(0, Math.ceil((endsAtMs - nowEstimate) / 1000));

      setRemainingSeconds(remaining);

      if (remaining <= 0 && !submittingRef.current) {
        void doSubmit();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, exam, doSubmit]);

  /* ---- local mutations (React state + IndexedDB, no network) -------- */

  const applyLocalChange = useCallback(
    async (
      questionId: string,
      changes: Partial<
        Pick<LocalResponse, 'selectedAnswer' | 'isMarkedForReview' | 'isVisited' | 'timeSpentSeconds'>
      >
    ) => {
      const current = examRef.current;
      if (!current) return;

      const updated = await upsertLocalResponse(current.attemptId, questionId, changes);
      setResponses((prev) => ({ ...prev, [questionId]: updated }));
      await updatePendingCount(current.attemptId);
    },
    [updatePendingCount]
  );

  const setAnswer = useCallback(
    (questionId: string, answer: string | null) => {
      void applyLocalChange(questionId, { selectedAnswer: answer, isVisited: true });
    },
    [applyLocalChange]
  );

  const toggleReview = useCallback(
    (questionId: string) => {
      const current = responses[questionId];
      void applyLocalChange(questionId, {
        isMarkedForReview: !current?.isMarkedForReview,
        isVisited: true,
      });
    },
    [applyLocalChange, responses]
  );

  const markVisited = useCallback(
    (questionId: string) => {
      if (responses[questionId]?.isVisited) return;
      void applyLocalChange(questionId, { isVisited: true });
    },
    [applyLocalChange, responses]
  );

  const addTimeSpent = useCallback(
    (questionId: string, seconds: number) => {
      const base = responses[questionId]?.timeSpentSeconds ?? 0;
      void applyLocalChange(questionId, { timeSpentSeconds: base + Math.max(0, seconds) });
    },
    [applyLocalChange, responses]
  );

  const recordViolation = useCallback(
    (type: ViolationType) => {
      const current = examRef.current;
      if (!current) return;

      void saveLocalViolation({
        attemptId: current.attemptId,
        type,
        section: current.section,
        occurredAt: new Date().toISOString(),
      }).then(() => {
        void updatePendingCount(current.attemptId);
      });
    },
    [updatePendingCount]
  );

  const isWarning = remainingSeconds > 0 && remainingSeconds <= 5 * 60;

  return useMemo(
    () => ({
      phase,
      currentSection: exam?.section ?? null,
      questionSets: exam?.questionSets ?? [],
      questions: exam?.questions ?? [],
      responses,
      remainingSeconds,
      isWarning,
      error,
      isSyncing,
      pendingCount,
      start,
      setAnswer,
      toggleReview,
      markVisited,
      addTimeSpent,
      recordViolation,
    }),
    [
      phase,
      exam,
      responses,
      remainingSeconds,
      isWarning,
      error,
      isSyncing,
      pendingCount,
      start,
      setAnswer,
      toggleReview,
      markVisited,
      addTimeSpent,
      recordViolation,
    ]
  );
}