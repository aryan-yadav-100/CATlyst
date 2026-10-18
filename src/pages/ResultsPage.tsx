import { Fragment, useEffect, useState } from 'react';
import {
  Trophy,
  TrendingUp,
  Target,
  ShieldAlert,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getReview, ApiError, type ReviewResult } from '@/lib/api';
import { SECTION_LABELS, SECTION_ORDER, type Section } from '@/types';
import type { Route } from '@/App';

type ReviewResponse = ReviewResult['responses'][number];
type Tab = 'scorecard' | 'area' | 'question' | 'selection';

const TAB_LABELS: Record<Tab, string> = {
  scorecard: 'Scorecard',
  area: 'Area-Wise',
  question: 'Question-Wise',
  selection: 'Question Selection',
};

interface Props {
  attemptId: string;
  onNavigate: (route: Route) => void;
}

/* ============================================================
   FORMATTING + CLASSIFICATION HELPERS
   Everything below is pure client-side math on the single
   get_review() payload -- no extra requests for any tab.
   ============================================================ */

function formatPercentile(value: number | null): string {
  if (value === null || value === undefined) return '--';
  return value.toFixed(2);
}

function formatHHMM(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const isAttempted = (r: ReviewResponse) => r.selected_answer !== null && r.selected_answer !== '';
const isSkipped = (r: ReviewResponse) => !isAttempted(r);
const isCorrect = (r: ReviewResponse) => isAttempted(r) && r.is_correct === true;
const isIncorrect = (r: ReviewResponse) => isAttempted(r) && r.is_correct === false;

interface GroupStats {
  label: string;
  responses: ReviewResponse[];
  marks: number;
  questions: number;
  attempts: number;
  correct: number;
  accuracy: number;
  timeSpentSeconds: number;
  marksPerMin: number | null;
  timePerAttempted: number | null;
}

function computeStats(label: string, responses: ReviewResponse[]): GroupStats {
  const marks = responses.reduce((sum, r) => sum + (r.marks_awarded ?? 0), 0);
  const attempts = responses.filter(isAttempted).length;
  const correct = responses.filter(isCorrect).length;
  const timeSpentSeconds = responses.reduce((sum, r) => sum + (r.time_spent_seconds ?? 0), 0);
  const minutes = timeSpentSeconds / 60;

  return {
    label,
    responses,
    marks,
    questions: responses.length,
    attempts,
    correct,
    accuracy: attempts > 0 ? (correct / attempts) * 100 : 0,
    timeSpentSeconds,
    marksPerMin: minutes > 0 ? marks / minutes : null,
    timePerAttempted: attempts > 0 ? timeSpentSeconds / attempts : null,
  };
}

/**
 * Groups responses by section, then by sub_topic within each section.
 * Sub-topics come straight from the admin-entered data on each
 * question (first-seen order), not from a hardcoded list, so this
 * keeps working if the set of sub-topics ever changes.
 */
function buildSectionGroups(responses: ReviewResponse[]) {
  return SECTION_ORDER.map((section) => {
    const sectionResponses = responses.filter((r) => r.section === section);

    const topicOrder: string[] = [];
    for (const r of sectionResponses) {
      const topic = r.sub_topic ?? 'Other';
      if (!topicOrder.includes(topic)) topicOrder.push(topic);
    }

    return {
      section,
      stats: computeStats(SECTION_LABELS[section], sectionResponses),
      subGroups: topicOrder.map((topic) =>
        computeStats(
          topic,
          sectionResponses.filter((r) => (r.sub_topic ?? 'Other') === topic)
        )
      ),
    };
  });
}

/** [A, B, C] x [correct, incorrect, skipped] counts for a set of responses. */
function selectionCounts(responses: ReviewResponse[]) {
  return (['A', 'B', 'C'] as const).map((type) => {
    const subset = responses.filter((r) => r.attempt_priority === type);
    return {
      correct: subset.filter(isCorrect).length,
      incorrect: subset.filter(isIncorrect).length,
      skipped: subset.filter(isSkipped).length,
    };
  });
}

/* ============================================================
   SMALL TABLE PIECES
   ============================================================ */

function StatCells({ stats }: { stats: GroupStats }) {
  return (
    <>
      <td className="p-3 text-right">{stats.marks}</td>
      <td className="p-3 text-right">{stats.questions}</td>
      <td className="p-3 text-right">{stats.attempts}</td>
      <td className="p-3 text-right">{stats.correct}</td>
      <td className="p-3 text-right">{stats.accuracy.toFixed(2)}</td>
      <td className="p-3 text-right">{formatHHMM(stats.timeSpentSeconds)}</td>
      <td className="p-3 text-right">
        {stats.marksPerMin !== null ? stats.marksPerMin.toFixed(2) : '--'}
      </td>
      <td className="p-3 text-right">
        {stats.timePerAttempted !== null ? formatMMSS(stats.timePerAttempted) : '--'}
      </td>
    </>
  );
}

function SelectionCells({ responses }: { responses: ReviewResponse[] }) {
  return (
    <>
      {selectionCounts(responses).flatMap((c, i) => [
        <td key={`${i}c`} className="p-3 text-right">{c.correct}</td>,
        <td key={`${i}i`} className="p-3 text-right">{c.incorrect}</td>,
        <td key={`${i}s`} className="p-3 text-right">{c.skipped}</td>,
      ])}
    </>
  );
}

function StatusIcon({ response }: { response: ReviewResponse }) {
  if (isSkipped(response)) return <MinusCircle className="w-4 h-4 text-neutral-400 inline" />;
  if (isCorrect(response)) return <CheckCircle2 className="w-4 h-4 text-success-500 inline" />;
  return <XCircle className="w-4 h-4 text-error-500 inline" />;
}

/* ============================================================
   PAGE
   ============================================================ */

export function ResultsPage({ attemptId, onNavigate }: Props) {
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('scorecard');
  const [expanded, setExpanded] = useState<Set<Section>>(new Set());
  const [sectionFilter, setSectionFilter] = useState<'All' | Section>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Correct' | 'Incorrect' | 'Skipped'>('All');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getReview(attemptId);
        if (!cancelled) setReview(result);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'NOT_SUBMITTED') {
          setError('This test has not been submitted yet.');
        } else if (err instanceof ApiError && err.code === 'ATTEMPT_NOT_FOUND') {
          setError('This result could not be found.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load your result');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="h-5 bg-neutral-200 rounded w-24 animate-pulse" />
            <div className="h-5 bg-neutral-200 rounded w-40 animate-pulse" />
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-28 bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>

          {/* Overall score card skeleton */}
          <div className="card p-6 sm:p-8 animate-pulse">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-neutral-200" />
                <div>
                  <div className="h-3 bg-neutral-200 rounded w-24 mb-2" />
                  <div className="h-8 bg-neutral-200 rounded w-20" />
                </div>
              </div>
              <div className="flex gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="text-right">
                    <div className="h-3 bg-neutral-200 rounded w-16 mb-2" />
                    <div className="h-6 bg-neutral-200 rounded w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section cards skeleton */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-3 bg-neutral-200 rounded w-10 mb-2" />
                <div className="h-3 bg-neutral-200 rounded w-32 mb-4" />
                <div className="h-7 bg-neutral-200 rounded w-14 mb-2" />
                <div className="h-3 bg-neutral-200 rounded w-24 mb-3" />
                <div className="h-3 bg-neutral-200 rounded w-28" />
              </div>
            ))}
          </div>

          {/* Question grid skeleton */}
          <div className="card p-6 animate-pulse">
            <div className="h-4 bg-neutral-200 rounded w-40 mb-4" />
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-neutral-200" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-error-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-neutral-800 mb-1">Couldn't load this result</h2>
          <p className="text-sm text-neutral-500 mb-6">{error}</p>
          <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-primary w-full">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const result = review.result;
  const responses = review.responses;
  const overallStats = computeStats('Overall', responses);
  const sectionGroups = buildSectionGroups(responses);

  // Question numbers restart at 1 within each section.
  const numberById = new Map<string, number>();
  for (const section of SECTION_ORDER) {
    responses
      .filter((r) => r.section === section)
      .forEach((r, idx) => numberById.set(r.question_id, idx + 1));
  }

  const toggleSection = (section: Section) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const filteredResponses = responses.filter((r) => {
    if (sectionFilter !== 'All' && r.section !== sectionFilter) return false;
    if (statusFilter === 'Correct' && !isCorrect(r)) return false;
    if (statusFilter === 'Incorrect' && !isIncorrect(r)) return false;
    if (statusFilter === 'Skipped' && !isSkipped(r)) return false;
    return true;
  });

  const sectionMarks: Record<Section, { raw: number | null; percentile: number | null }> = {
    VARC: { raw: result?.varc_raw_marks ?? null, percentile: result?.varc_percentile ?? null },
    DILR: { raw: result?.dilr_raw_marks ?? null, percentile: result?.dilr_percentile ?? null },
    QA: { raw: result?.qa_raw_marks ?? null, percentile: result?.qa_percentile ?? null },
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => onNavigate({ name: 'dashboard' })}
            className="btn-ghost text-sm flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-700">{review.mock_title ?? 'Mock Test'}</p>
              {review.submitted_at && (
                <p className="text-xs text-neutral-400">
                  Submitted {new Date(review.submitted_at).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate({ name: 'solutions', attemptId, mockTitle: review.mock_title ?? undefined })}
              className="btn-primary text-sm"
            >
              Review Solutions
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ---------------- Scorecard ---------------- */}
        {tab === 'scorecard' && (
          <>
            <div className="card p-6 sm:p-8">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Overall Score</p>
                    <p className="text-3xl font-bold text-neutral-900">
                      {result?.overall_raw_marks ?? '--'}
                      {result?.overall_grade && (
                        <span className="ml-2 text-base font-semibold text-primary-600">
                          Grade {result.overall_grade}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-xs text-neutral-400 flex items-center gap-1 justify-end">
                      <TrendingUp className="w-3.5 h-3.5" /> Percentile
                    </p>
                    <p className="text-xl font-semibold text-neutral-800">
                      {formatPercentile(result?.overall_percentile ?? null)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400 flex items-center gap-1 justify-end">
                      <Target className="w-3.5 h-3.5" /> Accuracy
                    </p>
                    <p className="text-xl font-semibold text-neutral-800">
                      {result?.accuracy_overall != null ? `${result.accuracy_overall.toFixed(1)}%` : '--'}
                    </p>
                  </div>
                  {review.violations_count > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-neutral-400 flex items-center gap-1 justify-end">
                        <ShieldAlert className="w-3.5 h-3.5" /> Flags
                      </p>
                      <p className="text-xl font-semibold text-warning-600">{review.violations_count}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {SECTION_ORDER.map((section) => {
                const marks = sectionMarks[section];
                const sectionResponses = responses.filter((r) => r.section === section);
                const answered = sectionResponses.filter(isAttempted).length;
                const correct = sectionResponses.filter(isCorrect).length;

                return (
                  <div key={section} className="card p-5">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                      {section}
                    </p>
                    <p className="text-sm text-neutral-500 mb-3">{SECTION_LABELS[section]}</p>
                    <p className="text-2xl font-bold text-neutral-900">{marks.raw ?? '--'}</p>
                    <p className="text-xs text-neutral-400 mb-3">
                      Percentile: {formatPercentile(marks.percentile)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {correct}/{answered} correct out of {sectionResponses.length} questions
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-neutral-800 mb-4">Question-wise Overview</h3>
              <div className="space-y-6">
                {SECTION_ORDER.map((section) => {
                  const sectionResponses = responses.filter((r) => r.section === section);
                  if (sectionResponses.length === 0) return null;

                  return (
                    <div key={section}>
                      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                        {section}
                      </p>
                      <div className="grid grid-cols-8 sm:grid-cols-12 gap-2">
                        {sectionResponses.map((r, idx) => {
                          const colorClass = isSkipped(r)
                            ? 'bg-neutral-100 text-neutral-400'
                            : isCorrect(r)
                            ? 'bg-success-100 text-success-700'
                            : 'bg-error-100 text-error-700';

                          return (
                            <div
                              key={r.question_id}
                              title={
                                isSkipped(r)
                                  ? 'Not answered'
                                  : isCorrect(r)
                                  ? `Correct (+${r.marks_awarded})`
                                  : `Incorrect (${r.marks_awarded})`
                              }
                              className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs font-medium ${colorClass}`}
                            >
                              <span>{idx + 1}</span>
                              <StatusIcon response={r} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-400 mt-6">
                The answer key is not shown for this test. Scores and correctness above reflect the
                official grading.
              </p>
            </div>
          </>
        )}

        {/* ---------------- Area-Wise ---------------- */}
        {tab === 'area' && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="p-3 text-left font-medium"></th>
                  <th className="p-3 text-right font-medium">Marks</th>
                  <th className="p-3 text-right font-medium">Questions</th>
                  <th className="p-3 text-right font-medium">Attempts</th>
                  <th className="p-3 text-right font-medium">No. of Correct</th>
                  <th className="p-3 text-right font-medium">Accuracy (%)</th>
                  <th className="p-3 text-right font-medium">Time Spent (HH:MM)</th>
                  <th className="p-3 text-right font-medium">Marks Per Min</th>
                  <th className="p-3 text-right font-medium">Time per Attempted (MM:SS)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-200 font-semibold">
                  <td className="p-3">Overall</td>
                  <StatCells stats={overallStats} />
                </tr>
                {sectionGroups.map(({ section, stats, subGroups }) => (
                  <Fragment key={section}>
                    <tr
                      onClick={() => toggleSection(section)}
                      className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                    >
                      <td className="p-3 font-medium">
                        <span className="inline-flex items-center gap-2">
                          {expanded.has(section) ? (
                            <ChevronUp className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          )}
                          {stats.label}
                        </span>
                      </td>
                      <StatCells stats={stats} />
                    </tr>
                    {expanded.has(section) &&
                      subGroups.map((group) => (
                        <tr key={`${section}-${group.label}`} className="border-b border-neutral-100 bg-neutral-50/60">
                          <td className="p-3 pl-10 text-neutral-600">{group.label}</td>
                          <StatCells stats={group} />
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------- Question-Wise ---------------- */}
        {tab === 'question' && (
          <div className="card overflow-x-auto">
            <div className="flex flex-wrap gap-3 p-4 border-b border-neutral-200">
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value as 'All' | Section)}
                className="input w-44"
              >
                <option value="All">Filter by: All Sections</option>
                {SECTION_ORDER.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="input w-44"
              >
                <option value="All">Filter by: All Status</option>
                <option value="Correct">Correct</option>
                <option value="Incorrect">Incorrect</option>
                <option value="Skipped">Skipped</option>
              </select>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="p-3 text-left font-medium">Section</th>
                  <th className="p-3 text-left font-medium">Question</th>
                  <th className="p-3 text-center font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Time Spent</th>
                  <th className="p-3 text-right font-medium">Topper's Time</th>
                  <th className="p-3 text-right font-medium">Topper's Attempt</th>
                  <th className="p-3 text-right font-medium">Topper's Accuracy</th>
                  <th className="p-3 text-right font-medium">Topper's p-value</th>
                  <th className="p-3 text-center font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredResponses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-neutral-400">
                      No questions match these filters.
                    </td>
                  </tr>
                ) : (
                  filteredResponses.map((r) => (
                    <tr key={r.question_id} className="border-b border-neutral-100">
                      <td className="p-3">{r.section}</td>
                      <td className="p-3 max-w-xs truncate" title={r.question_text}>
                        {numberById.get(r.question_id)}. {r.question_text}
                      </td>
                      <td className="p-3 text-center"><StatusIcon response={r} /></td>
                      <td className="p-3 text-right">{formatMMSS(r.time_spent_seconds)}</td>
                      <td className="p-3 text-right">{r.topper_time ?? '--'}</td>
                      <td className="p-3 text-right">{r.topper_attempt_pct ?? '--'}</td>
                      <td className="p-3 text-right">{r.topper_accuracy_pct ?? '--'}</td>
                      <td className="p-3 text-right">{r.topper_p_value ?? '--'}</td>
                      <td className="p-3 text-center font-semibold">{r.attempt_priority ?? '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------- Question Selection ---------------- */}
        {tab === 'selection' && (
          <div className="card overflow-x-auto">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-800">Test Performance Summary</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                A = attempt immediately, B = attempt later, C = do not attempt
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="p-3 text-left font-medium" rowSpan={2}>Section</th>
                  <th className="p-3 text-center font-medium border-l border-neutral-200" colSpan={3}>A</th>
                  <th className="p-3 text-center font-medium border-l border-neutral-200" colSpan={3}>B</th>
                  <th className="p-3 text-center font-medium border-l border-neutral-200" colSpan={3}>C</th>
                </tr>
                <tr className="border-b border-neutral-200 text-xs text-neutral-400">
                  {['A', 'B', 'C'].flatMap((t) =>
                    ['Correct', 'Incorrect', 'Skipped'].map((h) => (
                      <th key={`${t}-${h}`} className="p-2 text-right font-medium">{h}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-200 font-semibold">
                  <td className="p-3">Overall</td>
                  <SelectionCells responses={responses} />
                </tr>
                {sectionGroups.map(({ section, stats, subGroups }) => (
                  <Fragment key={section}>
                    <tr
                      onClick={() => toggleSection(section)}
                      className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                    >
                      <td className="p-3 font-medium">
                        <span className="inline-flex items-center gap-2">
                          {expanded.has(section) ? (
                            <ChevronUp className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          )}
                          {stats.label}
                        </span>
                      </td>
                      <SelectionCells responses={stats.responses} />
                    </tr>
                    {expanded.has(section) &&
                      subGroups.map((group) => (
                        <tr key={`${section}-${group.label}`} className="border-b border-neutral-100 bg-neutral-50/60">
                          <td className="p-3 pl-10 text-neutral-600">{group.label}</td>
                          <SelectionCells responses={group.responses} />
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}