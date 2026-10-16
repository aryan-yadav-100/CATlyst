import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { getSolutions, ApiError, type SolutionsResult, type SolutionQuestion } from '@/lib/api';
import { SECTION_LABELS, SECTION_ORDER, type Section } from '@/types';
import type { Route } from '@/App';

interface Props {
  attemptId: string;
  mockTitle?: string;
  onNavigate: (route: Route) => void;
}

type SubTab = 'statistics' | 'solution' | 'video';
type StatusFilter = 'all' | 'correct' | 'incorrect' | 'skipped';

const isAttempted = (q: SolutionQuestion) => q.selected_answer !== null && q.selected_answer !== '';
const isSkipped = (q: SolutionQuestion) => !isAttempted(q);
const isCorrect = (q: SolutionQuestion) => isAttempted(q) && q.is_correct === true;
const isIncorrect = (q: SolutionQuestion) => isAttempted(q) && q.is_correct === false;

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Accepts watch?v=, youtu.be/, and already-embed YouTube URLs. Returns
 * null for anything else so the caller can show a plain link instead
 * of trying to embed a non-YouTube URL. */
function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/embed/')[1];
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function SolutionsReviewPage({ attemptId, mockTitle, onNavigate }: Props) {
  const [sections, setSections] = useState<Partial<Record<Section, SolutionsResult>>>({});
  const [currentSection, setCurrentSection] = useState<Section>('VARC');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('statistics');
  const [showFilter, setShowFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadSection = useCallback(
    async (section: Section) => {
      if (sections[section]) return; // already cached -- no request

      setLoading(true);
      setError(null);
      try {
        const result = await getSolutions(attemptId, section);
        setSections((prev) => ({ ...prev, [section]: result }));
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === 'SOLUTIONS_NOT_RELEASED') {
            setError({ code: err.code, message: "Your instructor hasn't released solutions for this test yet." });
          } else if (err.code === 'NOT_SUBMITTED') {
            setError({ code: err.code, message: 'This test has not been submitted yet.' });
          } else {
            setError({ code: err.code, message: err.message });
          }
        } else {
          setError({ message: err instanceof Error ? err.message : 'Failed to load solutions' });
        }
      } finally {
        setLoading(false);
      }
    },
    [attemptId, sections]
  );

  useEffect(() => {
    void loadSection(currentSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection]);

  const switchSection = (section: Section) => {
    setCurrentSection(section);
    setCurrentIndex(0);
    setSubTab('statistics');
    setShowFilter(false);
  };

  if (loading && !sections[currentSection]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-pulse text-neutral-400 text-sm">Loading solutions...</div>
      </div>
    );
  }

  if (error && !sections[currentSection]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-warning-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-neutral-800 mb-1">Solutions not available</h2>
          <p className="text-sm text-neutral-500 mb-6">{error.message}</p>
          <button onClick={() => onNavigate({ name: 'results', attemptId })} className="btn-primary w-full">
            Back to Scorecard
          </button>
        </div>
      </div>
    );
  }

  const data = sections[currentSection];
  if (!data) return null;

  const questions = data.questions;
  const currentQuestion = questions[currentIndex];
  const currentSet = currentQuestion?.set_id
    ? data.question_sets.find((s) => s.id === currentQuestion.set_id)
    : undefined;

  const matchesFilter = (q: SolutionQuestion) => {
    if (statusFilter === 'correct') return isCorrect(q);
    if (statusFilter === 'incorrect') return isIncorrect(q);
    if (statusFilter === 'skipped') return isSkipped(q);
    return true;
  };

  const goTo = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
    setSubTab('statistics');
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'results', attemptId })} className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="font-semibold text-neutral-900">{mockTitle ?? 'Solutions Review'}</p>
            <select
              value={currentSection}
              onChange={(e) => switchSection(e.target.value as Section)}
              className="text-sm text-primary-600 font-medium bg-transparent border-none p-0 cursor-pointer focus:outline-none"
            >
              {SECTION_ORDER.map((s) => (
                <option key={s} value={s}>{SECTION_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={() => setShowFilter((v) => !v)} className="btn-secondary text-sm">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-40 z-20">
                {(['all', 'correct', 'incorrect', 'skipped'] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setStatusFilter(f); setShowFilter(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm capitalize hover:bg-neutral-50 ${
                      statusFilter === f ? 'text-primary-600 font-medium' : 'text-neutral-600'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="btn-ghost p-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1}
            className="btn-ghost p-2 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {!currentQuestion ? (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
          No questions in this section.
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {currentSet && (currentSet.passage_text || currentSet.passage_image_url) ? (
            <div className="w-1/2 border-r border-neutral-200 overflow-y-auto p-6 bg-neutral-50">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Passage</h3>
              {currentSet.passage_text && (
                <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                  {currentSet.passage_text}
                </p>
              )}
              {currentSet.passage_image_url && (
                <img
                  src={currentSet.passage_image_url}
                  alt="Passage"
                  className="max-w-full rounded-lg border border-neutral-200 mt-4"
                />
              )}
            </div>
          ) : null}

          <div className={`${currentSet ? 'w-1/2' : 'flex-1'} overflow-y-auto p-6`}>
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-sm font-medium text-neutral-500">
                {currentIndex + 1}/{questions.length}
              </p>

              <div className="card p-6">
                <p className="text-neutral-900 mb-5 whitespace-pre-wrap leading-relaxed">
                  {currentQuestion.question_text}
                </p>

                {currentQuestion.image_url && (
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="max-w-full rounded-lg border border-neutral-200 mb-5"
                  />
                )}

                {currentQuestion.question_type === 'MCQ' && currentQuestion.options ? (
                  <div className="space-y-2">
                    {currentQuestion.options.map((option) => {
                      const isYourAnswer = currentQuestion.selected_answer === option.id;
                      const isTheCorrectAnswer = currentQuestion.correct_answer === option.id;
                      let cls = 'border-neutral-200 text-neutral-700';
                      if (isTheCorrectAnswer) cls = 'border-success-400 bg-success-50 text-success-800';
                      else if (isYourAnswer && !isTheCorrectAnswer) cls = 'border-error-400 bg-error-50 text-error-800';

                      return (
                        <div key={option.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${cls}`}>
                          <span>{option.text}</span>
                          <span className="flex items-center gap-2 flex-shrink-0 ml-3">
                            {isYourAnswer && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-800 text-white">
                                Your answer
                              </span>
                            )}
                            {isTheCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-success-600" />}
                            {isYourAnswer && !isTheCorrectAnswer && <XCircle className="w-4 h-4 text-error-600" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200">
                      <span className="text-neutral-500">Your answer</span>
                      <span className="font-medium text-neutral-800">
                        {isAttempted(currentQuestion) ? currentQuestion.selected_answer : 'Not attempted'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-success-300 bg-success-50">
                      <span className="text-success-700">Correct answer</span>
                      <span className="font-medium text-success-800">{currentQuestion.correct_answer}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-4 text-xs text-neutral-400">
                  <span>+{currentQuestion.marks} / -{currentQuestion.negative_marks}</span>
                  {currentQuestion.attempt_priority && (
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-medium">
                      Question Type {currentQuestion.attempt_priority}
                    </span>
                  )}
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="card overflow-hidden">
                <div className="flex border-b border-neutral-200">
                  {(['statistics', 'solution', 'video'] as SubTab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSubTab(t)}
                      className={`flex-1 py-2.5 text-sm font-medium capitalize ${
                        subTab === t
                          ? 'text-primary-600 border-b-2 border-primary-600'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      {t === 'statistics' ? 'Statistics' : t === 'solution' ? 'Solution' : 'Video Solution'}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {subTab === 'statistics' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-neutral-400">
                          <th className="pb-2 font-medium">Parameter</th>
                          <th className="pb-2 font-medium text-right">You</th>
                          <th className="pb-2 font-medium text-right">Topper</th>
                          <th className="pb-2 font-medium text-right">Overall</th>
                        </tr>
                      </thead>
                      <tbody className="text-neutral-700">
                        <tr className="border-t border-neutral-100">
                          <td className="py-2">Attempt</td>
                          <td className="py-2 text-right">
                            <span className={isAttempted(currentQuestion) ? 'text-success-600' : 'text-neutral-400'}>
                              {isAttempted(currentQuestion) ? 'Answered' : 'Not answered'}
                            </span>
                          </td>
                          <td className="py-2 text-right">{currentQuestion.topper_attempt_pct ?? '--'}%</td>
                          <td className="py-2 text-right">{currentQuestion.overall_attempt_pct ?? '--'}%</td>
                        </tr>
                        <tr className="border-t border-neutral-100">
                          <td className="py-2">Accuracy</td>
                          <td className="py-2 text-right">
                            <span className={
                              isCorrect(currentQuestion) ? 'text-success-600'
                              : isIncorrect(currentQuestion) ? 'text-error-600'
                              : 'text-neutral-400'
                            }>
                              {isCorrect(currentQuestion) ? 'Correct' : isIncorrect(currentQuestion) ? 'Incorrect' : 'Not attempted'}
                            </span>
                          </td>
                          <td className="py-2 text-right">{currentQuestion.topper_accuracy_pct ?? '--'}%</td>
                          <td className="py-2 text-right">{currentQuestion.overall_accuracy_pct ?? '--'}%</td>
                        </tr>
                        <tr className="border-t border-neutral-100">
                          <td className="py-2">Time Taken</td>
                          <td className="py-2 text-right">{formatMMSS(currentQuestion.time_spent_seconds)}</td>
                          <td className="py-2 text-right">{currentQuestion.topper_time ?? '--'}</td>
                          <td className="py-2 text-right">{currentQuestion.overall_time ?? '--'}</td>
                        </tr>
                        <tr className="border-t border-neutral-100">
                          <td className="py-2">p-value</td>
                          <td className="py-2 text-right text-neutral-400">NA</td>
                          <td className="py-2 text-right">{currentQuestion.topper_p_value ?? '--'}</td>
                          <td className="py-2 text-right">{currentQuestion.overall_p_value ?? '--'}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {subTab === 'solution' && (
                    currentQuestion.solution_image_url ? (
                      <img
                        src={currentQuestion.solution_image_url}
                        alt="Solution"
                        className="max-w-full rounded-lg border border-neutral-200"
                      />
                    ) : (
                      <p className="text-sm text-neutral-400 text-center py-8">No solution image added yet.</p>
                    )
                  )}

                  {subTab === 'video' && (
                    currentQuestion.solution_video_url ? (
                      toYouTubeEmbedUrl(currentQuestion.solution_video_url) ? (
                        <div className="aspect-video">
                          <iframe
                            src={toYouTubeEmbedUrl(currentQuestion.solution_video_url)!}
                            className="w-full h-full rounded-lg"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <a
                          href={currentQuestion.solution_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 underline"
                        >
                          Open video solution
                        </a>
                      )
                    ) : (
                      <p className="text-sm text-neutral-400 text-center py-8">No video solution added yet.</p>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:w-72 bg-white border-l border-neutral-200 p-4 overflow-y-auto hidden lg:block">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Questions</p>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const dimmed = !matchesFilter(q);
                let colorClass = 'bg-neutral-100 text-neutral-500';
                if (isCorrect(q)) colorClass = 'bg-success-100 text-success-700';
                else if (isIncorrect(q)) colorClass = 'bg-error-100 text-error-700';

                return (
                  <button
                    key={q.id}
                    onClick={() => goTo(idx)}
                    className={`aspect-square rounded-md text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${colorClass} ${
                      isCurrent ? 'ring-2 ring-primary-500' : ''
                    } ${dimmed ? 'opacity-30' : ''}`}
                  >
                    <span>{idx + 1}</span>
                    {isSkipped(q) ? (
                      <MinusCircle className="w-3 h-3" />
                    ) : isCorrect(q) ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs text-neutral-400">
              <Clock className="w-3.5 h-3.5" />
              Switching sections loads once -- revisiting costs nothing.
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}