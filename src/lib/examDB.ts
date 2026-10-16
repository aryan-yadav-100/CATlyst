import type { Section, ViolationType } from '../types';

const DB_NAME = 'cat-mock-exam';
const DB_VERSION = 2;

const STORES = {
  exams: 'exams',
  responses: 'responses',
  violations: 'violations',
} as const;

// v1 also had a `syncQueue` store. It duplicated the same "needs
// sync" information the dirty flag already carried and was never
// actually consulted correctly (booleans aren't valid IndexedDB index
// keys, so its indexes were silently inert). Removed in v2 --
// clientSeq/syncedSeq below is the single source of truth for what
// still needs to reach the server.

/* ============================================================
   LOCAL TYPES
   ============================================================ */

export interface CachedQuestionSet {
  id: string;
  section: Section;
  passage_text: string | null;
  passage_image_url: string | null;
  display_order: number;
}

export interface CachedQuestion {
  id: string;
  set_id: string | null;
  section: Section;
  display_order: number;
  question_type: 'MCQ' | 'TITA';
  question_text: string;
  image_url: string | null;
  options: { id: string; text: string }[] | null;
  marks: number;
  negative_marks: number;
  difficulty: string | null;
  version: number;
}

export interface LocalExam {
  attemptId: string;
  mockId: string;

  section: Section;

  sessionId: string;
  tabId: string;

  /** Authoritative deadline, as returned by the server. */
  sectionStartedAt: string;
  sectionEndsAt: string;

  /**
   * serverNow - localNow at the moment this was last refreshed. Used
   * so the countdown is based on the server's clock rather than the
   * device's, which may be wrong. Refreshed opportunistically on every
   * sync response, not just on load.
   */
  serverOffsetMs: number;

  loadedAt: string;
  stateVersion: number;

  /**
   * Cached so a refresh (or a brief offline period right after
   * loading) doesn't need a round trip just to redisplay the section.
   */
  questionSets: CachedQuestionSet[];
  questions: CachedQuestion[];
}

export interface LocalResponse {
  id: string;

  attemptId: string;
  questionId: string;

  selectedAnswer: string | null;
  isMarkedForReview: boolean;
  isVisited: boolean;
  timeSpentSeconds: number;

  updatedAt: string;

  /** Bumped on every local edit. */
  clientSeq: number;

  /**
   * Highest clientSeq the server has confirmed receiving. A response
   * is dirty exactly when clientSeq > syncedSeq. Replaces v1's `dirty`
   * boolean: with a boolean, an edit made WHILE a sync request for the
   * same question was in flight could get marked clean once that
   * request resolved, silently losing the newer edit. With a
   * sequence number, syncedSeq is only ever advanced up to the seq
   * that was actually sent, so a newer edit made mid-flight is
   * correctly left dirty for the next sync.
   */
  syncedSeq: number;
}

export interface LocalViolation {
  /** Same value sent to the server as client_id, for de-duplication
   * on retry. */
  id: string;

  attemptId: string;
  type: ViolationType;
  section: Section | null;
  occurredAt: string;

  synced: boolean;
}

/* ============================================================
   DATABASE
   ============================================================ */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;

      // This is a local cache / offline write-buffer, not a source of
      // truth -- on a schema version bump there is nothing in an old
      // store worth migrating row-by-row. Drop everything and recreate.
      for (const name of Array.from(db.objectStoreNames)) {
        db.deleteObjectStore(name);
      }

      db.createObjectStore(STORES.exams, { keyPath: 'attemptId' });

      const responseStore = db.createObjectStore(STORES.responses, { keyPath: 'id' });
      responseStore.createIndex('by_attempt', 'attemptId', { unique: false });
      responseStore.createIndex('by_attempt_question', ['attemptId', 'questionId'], { unique: true });

      const violationStore = db.createObjectStore(STORES.violations, { keyPath: 'id' });
      violationStore.createIndex('by_attempt', 'attemptId', { unique: false });
    };
  });

  return dbPromise;
}

/* ============================================================
   GENERIC HELPERS
   ============================================================ */

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function createId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ============================================================
   EXAM
   ============================================================ */

export async function saveLocalExam(exam: LocalExam): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORES.exams, 'readwrite');
  transaction.objectStore(STORES.exams).put(exam);
  await transactionToPromise(transaction);
}

export async function getLocalExam(attemptId: string): Promise<LocalExam | undefined> {
  const db = await openDatabase();
  const transaction = db.transaction(STORES.exams, 'readonly');
  const request = transaction.objectStore(STORES.exams).get(attemptId);
  return requestToPromise(request);
}

export async function deleteLocalExam(attemptId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORES.exams, 'readwrite');
  transaction.objectStore(STORES.exams).delete(attemptId);
  await transactionToPromise(transaction);
}

/* ============================================================
   RESPONSES
   ============================================================ */

/**
 * The only way local answers are written. Reads the existing row (if
 * any), applies the given field changes, bumps clientSeq, and stores
 * the result. Never touches the network.
 */
export async function upsertLocalResponse(
  attemptId: string,
  questionId: string,
  changes: Partial<
    Pick<LocalResponse, 'selectedAnswer' | 'isMarkedForReview' | 'isVisited' | 'timeSpentSeconds'>
  >
): Promise<LocalResponse> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.responses, 'readwrite');
    const store = transaction.objectStore(STORES.responses);
    const index = store.index('by_attempt_question');
    const getRequest = index.get([attemptId, questionId]);

    getRequest.onsuccess = () => {
      const existing = getRequest.result as LocalResponse | undefined;

      const updated: LocalResponse = existing
        ? {
            ...existing,
            ...changes,
            updatedAt: new Date().toISOString(),
            clientSeq: existing.clientSeq + 1,
          }
        : {
            id: createId(),
            attemptId,
            questionId,
            selectedAnswer: null,
            isMarkedForReview: false,
            isVisited: false,
            timeSpentSeconds: 0,
            ...changes,
            updatedAt: new Date().toISOString(),
            clientSeq: 1,
            syncedSeq: 0,
          };

      store.put(updated);

      transaction.oncomplete = () => resolve(updated);
      transaction.onerror = () => reject(transaction.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function getLocalResponses(attemptId: string): Promise<LocalResponse[]> {
  const db = await openDatabase();
  const transaction = db.transaction(STORES.responses, 'readonly');
  const request = transaction.objectStore(STORES.responses).index('by_attempt').getAll(attemptId);
  return requestToPromise(request);
}

export async function getDirtyResponses(attemptId: string): Promise<LocalResponse[]> {
  const responses = await getLocalResponses(attemptId);
  return responses.filter((response) => response.clientSeq > response.syncedSeq);
}

/**
 * Advances syncedSeq for each question up to the seq that was actually
 * sent -- never higher, and never for a question not in the map. If
 * the student changed an answer again while the request was in
 * flight, clientSeq has already moved past sentSeq, so that row
 * correctly remains dirty afterwards.
 */
export async function markResponsesSyncedUpTo(
  attemptId: string,
  sentSeqByQuestionId: Record<string, number>
): Promise<void> {
  if (Object.keys(sentSeqByQuestionId).length === 0) {
    return;
  }

  const db = await openDatabase();
  const transaction = db.transaction(STORES.responses, 'readwrite');
  const store = transaction.objectStore(STORES.responses);
  const index = store.index('by_attempt');
  const cursorRequest = index.openCursor(IDBKeyRange.only(attemptId));

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;

    const response = cursor.value as LocalResponse;
    const sentSeq = sentSeqByQuestionId[response.questionId];

    if (sentSeq !== undefined && sentSeq > response.syncedSeq) {
      cursor.update({ ...response, syncedSeq: sentSeq });
    }

    cursor.continue();
  };

  await transactionToPromise(transaction);
}

/* ============================================================
   VIOLATIONS
   ============================================================ */

export async function saveLocalViolation(input: {
  attemptId: string;
  type: ViolationType;
  section: Section | null;
  occurredAt: string;
}): Promise<LocalViolation> {
  const db = await openDatabase();
  const violation: LocalViolation = {
    id: createId(),
    ...input,
    synced: false,
  };

  const transaction = db.transaction(STORES.violations, 'readwrite');
  transaction.objectStore(STORES.violations).put(violation);
  await transactionToPromise(transaction);

  return violation;
}

export async function getDirtyViolations(attemptId: string): Promise<LocalViolation[]> {
  const db = await openDatabase();
  const transaction = db.transaction(STORES.violations, 'readonly');
  const request = transaction.objectStore(STORES.violations).index('by_attempt').getAll(attemptId);
  const violations = await requestToPromise<LocalViolation[]>(request);
  return violations.filter((violation) => !violation.synced);
}

export async function markViolationsSynced(violationIds: string[]): Promise<void> {
  if (violationIds.length === 0) return;

  const db = await openDatabase();
  const transaction = db.transaction(STORES.violations, 'readwrite');
  const store = transaction.objectStore(STORES.violations);

  for (const id of violationIds) {
    const request = store.get(id);
    request.onsuccess = () => {
      const violation = request.result as LocalViolation | undefined;
      if (!violation) return;
      violation.synced = true;
      store.put(violation);
    };
  }

  await transactionToPromise(transaction);
}

/* ============================================================
   CLEANUP
   ============================================================ */

/** Clears everything for one attempt -- called after a section
 * completes (the next section's enter_section call rebuilds the exam
 * record and responses fresh) and after the final submit. */
export async function clearAttemptData(attemptId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction([STORES.exams, STORES.responses, STORES.violations], 'readwrite');

  transaction.objectStore(STORES.exams).delete(attemptId);

  const responseStore = transaction.objectStore(STORES.responses);
  const responseRequest = responseStore.index('by_attempt').openCursor(IDBKeyRange.only(attemptId));
  responseRequest.onsuccess = () => {
    const cursor = responseRequest.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  const violationStore = transaction.objectStore(STORES.violations);
  const violationRequest = violationStore.index('by_attempt').openCursor(IDBKeyRange.only(attemptId));
  violationRequest.onsuccess = () => {
    const cursor = violationRequest.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  await transactionToPromise(transaction);
}

/** Wipes every store entirely -- call on logout, so a shared/kiosk
 * machine doesn't retain a previous student's local answers. */
export async function wipeAllLocalData(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(
    [STORES.exams, STORES.responses, STORES.violations],
    'readwrite'
  );
  transaction.objectStore(STORES.exams).clear();
  transaction.objectStore(STORES.responses).clear();
  transaction.objectStore(STORES.violations).clear();
  await transactionToPromise(transaction);
}

export async function closeExamDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}