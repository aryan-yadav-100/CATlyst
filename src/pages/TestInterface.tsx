import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Clock,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Flag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useExamEngine } from '@/hooks/examEngine';
import { SECTION_LABELS } from '@/types';
import type { Route } from '@/App';

interface Props {
  mockId: string;
  onNavigate: (route: Route) => void;
}

/* ============================================================
   NAVY EXAM STYLESHEET
   ============================================================
   Adapted directly from the reference navy palette, with every
   class renamed to an `exam-` prefix. This is load-bearing, not
   cosmetic: the app's global stylesheet already defines `.btn`,
   `.btn-primary`, `.card`, `.input`, etc. for every other page. A
   plain <style> tag applies globally regardless of where it's
   rendered in the tree -- reusing those exact names here would
   silently repaint buttons and cards on StudentDashboard, AdminPanel
   and ResultsPage the instant a student opens the exam screen.
   Every selector below is exam-* and can't collide with anything
   else in the app.
*/
const EXAM_STYLES = `
  :root{
    --exam-navy:#1a3c6e;
    --exam-navy-dark:#0f2a4f;
    --exam-grey-not-visited:#8d9aa5;
    --exam-red-not-answered:#e35555;
    --exam-green-answered:#3aa655;
    --exam-purple-marked:#8b5cf6;
    --exam-border-c:#d7dce2;
    --exam-text:#1f2933;
    --exam-muted:#5b6673;
  }

  .exam-shell{
    font-family:Arial, "Segoe UI", Helvetica, sans-serif;
    color:var(--exam-text);
    background:#ffffff;
    height:100vh;
    height:100dvh;
    min-height:0;
    width:100%;
    display:flex;
    flex-direction:column;
    overflow:hidden;
  }

  .exam-btn{
    font-family:inherit;
    font-size:13px;
    font-weight:600;
    padding:9px 14px;
    border-radius:3px;
    border:1px solid var(--exam-border-c);
    background:#fff;
    color:var(--exam-text);
    cursor:pointer;
    display:inline-flex;
    align-items:center;
    gap:6px;
  }
  .exam-btn:hover{ background:#f2f5f8; }
  .exam-btn:disabled{ opacity:.45; cursor:not-allowed; }

  .exam-btn-primary{
    background:var(--exam-navy);
    color:#fff;
    border-color:var(--exam-navy);
  }
  .exam-btn-primary:hover{ background:var(--exam-navy-dark); }

  .exam-btn-green{
    background:#1e8449;
    color:#fff;
    border-color:#1e8449;
  }
  .exam-btn-green:hover{ background:#166b3a; }

  .exam-btn-red{
    background:#cb4335;
    color:#fff;
    border-color:#cb4335;
  }
  .exam-btn-red:hover{ background:#a8362a; }

  .exam-btn-purple{
    background:#7d3c98;
    color:#fff;
    border-color:#7d3c98;
  }
  .exam-btn-purple:hover{ background:#652f7a; }

  .exam-btn-small{ padding:5px 10px; font-size:12px; }
  .exam-btn-full{ width:100%; justify-content:center; }

  .exam-centered{
    flex:1;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
  }

  .exam-panel{
    max-width:480px;
    width:100%;
    border:1px solid var(--exam-border-c);
    border-radius:6px;
    padding:32px;
    text-align:center;
    background:#fff;
  }

  .exam-panel h2{
    font-size:19px;
    font-weight:800;
    color:var(--exam-navy);
    margin:0 0 10px;
  }

  .exam-panel p{
    font-size:13.5px;
    color:var(--exam-muted);
    line-height:1.6;
    margin:0 0 20px;
  }

  .exam-loading{
    color:var(--exam-muted);
    font-size:13px;
  }

  /* ---- Header / timer ---- */

  .exam-test-header{
    background:var(--exam-navy);
    color:#fff;
    padding:10px 18px;
    min-height:54px;
    box-sizing:border-box;
    display:flex;
    align-items:center;
    justify-content:space-between;
    flex-wrap:wrap;
    gap:10px;
    flex-shrink:0;
    border-bottom:1px solid #0b2a4b;
  }

  .exam-test-header .exam-title{
    font-size:14px;
    font-weight:700;
  }

  .exam-test-header .exam-subtle{
    font-size:11.5px;
    opacity:.8;
  }

  .exam-timer-box{
    background:rgba(255,255,255,.12);
    border-radius:4px;
    padding:6px 14px;
    font-family:'Courier New',monospace;
    font-size:18px;
    font-weight:700;
    letter-spacing:1px;
    display:flex;
    align-items:center;
    gap:8px;
  }

  .exam-timer-box.exam-low{ background:#cb4335; }

  /* ---- Body layout ---- */

  .exam-test-body{
    flex:1 1 auto;
    display:flex;
    min-height:0;
    height:0;
    overflow:hidden;
    align-items:stretch;
  }

  .exam-passage-pane{
    flex:1 1 0;
    width:auto;
    min-width:0;
    border-right:2px solid var(--exam-border-c);
    padding:18px 20px;
    overflow-y:auto;
    overflow-x:hidden;
    overscroll-behavior:contain;
    background:#fff;
    min-height:0;
    height:100%;
    box-sizing:border-box;
  }

  .exam-passage-pane h3{
    margin:0 0 12px;
    font-size:13px;
    color:var(--exam-navy);
    text-transform:uppercase;
    letter-spacing:.4px;
  }

  .exam-passage-pane .exam-ptext{
    font-size:14.5px;
    line-height:1.85;
    white-space:pre-wrap;
    color:#222;
  }

  .exam-set-image{
    max-width:100%;
    border:1px solid var(--exam-border-c);
    border-radius:4px;
    margin-top:12px;
    display:block;
  }

  .exam-qa-pane{
    flex:1 1 0;
    width:auto;
    display:flex;
    flex-direction:column;
    min-width:0;
    min-height:0;
    height:100%;
    overflow:hidden;
  }

  .exam-qa-pane.exam-full{ flex:1 1 0; width:auto; }

  .exam-qa-scroll{
    flex:1 1 auto;
    overflow-y:auto;
    overflow-x:hidden;
    overscroll-behavior:contain;
    padding:18px 20px;
    min-height:0;
  }

  .exam-qmeta{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:10px;
    font-size:12px;
    color:var(--exam-muted);
  }

  .exam-qmeta .exam-marks .exam-c{ color:#1e8449; font-weight:700; }
  .exam-qmeta .exam-marks .exam-w{ color:#cb4335; font-weight:700; }

  .exam-qtext{
    font-size:15px;
    font-weight:600;
    line-height:1.55;
    margin-bottom:16px;
    white-space:pre-wrap;
  }

  .exam-set-image-q{
    max-width:100%;
    border:1px solid var(--exam-border-c);
    border-radius:4px;
    margin-bottom:16px;
    display:block;
  }

  .exam-option{
    display:flex;
    align-items:flex-start;
    gap:10px;
    padding:10px 12px;
    border:1px solid var(--exam-border-c);
    border-radius:4px;
    margin-bottom:9px;
    cursor:pointer;
    font-size:14px;
    line-height:1.5;
    white-space:pre-wrap;
    background:#fff;
  }

  .exam-option:hover{ background:#f5f8fb; }

  .exam-option.exam-selected{
    background:#e8f0fb;
    border-color:var(--exam-navy);
  }

  .exam-option .exam-oletter{
    font-weight:700;
    color:var(--exam-navy);
    flex-shrink:0;
  }

  .exam-tita-wrap{ display:flex; flex-direction:column; align-items:flex-start; gap:0; }
  .exam-tita-box{
    width:100%;
    max-width:260px;
    padding:10px 12px;
    border:1px solid #888;
    border-radius:2px;
    font-size:15px;
    font-family:inherit;
    background:#fff;
    color:#111;
    min-height:36px;
  }
  .exam-tita-keypad{
    width:181px;
    box-sizing:border-box;
    padding:8px 10px;
    margin-left:0;
    background:#f2f2f2;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:5px;
  }
  .exam-tita-key{
    min-width:30px;
    height:41px;
    padding:0 8px;
    border:1px solid #888;
    border-radius:10px;
    background:linear-gradient(#fff,#e9e9e9);
    color:#111;
    font-size:17px;
    font-weight:700;
    cursor:pointer;
  }
  .exam-tita-key:active{ background:#d9e7f3; }
  .exam-tita-key-wide{ height:41px; min-width:0; padding:0 9px; font-size:16px; }
  .exam-tita-key-row{ display:flex; justify-content:center; gap:5px; }

  .exam-action-row{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    padding:12px 16px;
    border-top:1px solid var(--exam-border-c);
    background:#fff;
    flex-shrink:0;
  }

  .exam-nav-row{
    display:flex;
    justify-content:space-between;
    gap:8px;
    padding:10px 16px;
    border-top:1px solid var(--exam-border-c);
    background:#fff;
    flex-shrink:0;
  }

  /* ---- Palette ---- */

  .exam-palette-pane{
    flex:0 0 238px;
    width:238px;
    box-sizing:border-box;
    border-left:1px solid var(--exam-border-c);
    padding:16px 14px;
    overflow-y:auto;
    overflow-x:hidden;
    overscroll-behavior:contain;
    background:#e7f5fb;
    min-height:0;
    height:100%;
  }

  .exam-palette-pane h4{
    font-size:12px;
    color:var(--exam-navy);
    margin:0 0 10px;
    text-transform:uppercase;
  }

  .exam-palette-grid{
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:6px;
    margin-bottom:16px;
  }

  .exam-pal-btn{
    width:100%;
    max-width:42px;
    height:38px;
    border-radius:4px;
    border:none;
    font-size:12px;
    font-weight:700;
    color:#fff;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:0;
  }

  .exam-pal-not-visited{ background:var(--exam-grey-not-visited); }
  .exam-pal-not-answered{ background:var(--exam-red-not-answered); }
  .exam-pal-answered{ background:var(--exam-green-answered); }
  .exam-pal-marked{ background:var(--exam-purple-marked); border-radius:50%; }
  .exam-pal-answered-marked{
    background:var(--exam-purple-marked);
    border-radius:50%;
    box-shadow:inset 0 0 0 3px var(--exam-green-answered);
  }

  .exam-pal-btn.exam-current{
    outline:2px solid var(--exam-navy);
    outline-offset:2px;
  }

  .exam-legend{
    font-size:11px;
    color:var(--exam-muted);
    display:flex;
    flex-direction:column;
    gap:6px;
  }

  .exam-legend .exam-row{
    display:flex;
    align-items:center;
    gap:7px;
  }

  .exam-legend .exam-sw{
    width:14px;
    height:14px;
    border-radius:3px;
    flex-shrink:0;
  }

  .exam-sync-status{
    margin-top:14px;
    display:flex;
    align-items:center;
    gap:6px;
    font-size:11px;
    color:var(--exam-muted);
  }

  .exam-shell *::-webkit-scrollbar{ width:9px; height:9px; }
  .exam-shell *::-webkit-scrollbar-track{ background:#f1f3f5; }
  .exam-shell *::-webkit-scrollbar-thumb{ background:#aeb8c2; border-radius:5px; }
  @media (max-width: 900px){
    .exam-palette-pane{ flex-basis:190px; width:190px; padding:12px 10px; }
    .exam-passage-pane, .exam-qa-scroll{ padding:14px; }
    .exam-action-row, .exam-nav-row{ padding:10px; }
    .exam-btn{ padding:8px 10px; }
  }
  @media (max-width: 640px){
    .exam-test-header{ padding:8px 12px; }
    .exam-test-body{ flex-wrap:wrap; }
    .exam-passage-pane{ flex:0 0 100%; width:100%; height:42%; border-right:0; border-bottom:1px solid var(--exam-border-c); }
    .exam-qa-pane, .exam-qa-pane.exam-full{ flex:1 1 100%; width:100%; min-height:0; }
    .exam-palette-pane{ flex:0 0 100%; width:100%; height:auto; max-height:150px; border-left:0; border-top:1px solid var(--exam-border-c); }
    .exam-palette-grid{ grid-template-columns:repeat(8,minmax(0,1fr)); }
  }
`;

function ExamShell({ children }: { children: ReactNode }) {
  return (
    <div className="exam-shell">
      <style>{EXAM_STYLES}</style>
      {children}
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

async function requestFullscreenBestEffort() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Some browsers/embedded webviews reject this even from a direct
    // user gesture. The exam still functions -- fullscreen-exit
    // detection simply won't have anything to detect in that case.
  }
}

const TRANSITION_SECONDS = 10;

/**
 * Auto-advances to the next section after a countdown, with a "Continue
 * Now" option for anyone who doesn't want to wait it out. Guarded
 * against double-firing with a ref, since onAdvance triggers a
 * fullscreen request + engine.start() that should only ever run once
 * per screen (either the timer or the button, never both).
 */
function TransitionScreen({ onAdvance }: { onAdvance: () => void | Promise<void> }) {
  const [secondsLeft, setSecondsLeft] = useState(TRANSITION_SECONDS);
  const firedRef = useRef(false);

  const fireOnce = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void onAdvance();
  }, [onAdvance]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      fireOnce();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft, fireOnce]);

  return (
    <div className="exam-centered">
      <div className="exam-panel">
        <CheckCircle2 className="w-10 h-10" style={{ color: '#1e8449', margin: '0 auto 12px' }} />
        <h2>Section submitted</h2>
        <p>
          The next section starts automatically in{' '}
          <strong style={{ color: 'var(--exam-text)' }}>{secondsLeft}s</strong>.
        </p>
        <button onClick={fireOnce} className="exam-btn exam-btn-primary exam-btn-full">
          Continue Now
        </button>
      </div>
    </div>
  );
}

/**
 * The question + options + nav-buttons block, shared between the
 * "has a passage/set" split-pane layout and the "standalone question"
 * single-column layout so the two don't drift out of sync.
 */
function QuestionPanel({
  currentQuestion,
  currentIndex,
  totalQuestions,
  currentResponse,
  engine,
  goToQuestion,
}: {
  currentQuestion: NonNullable<ReturnType<typeof useExamEngine>['questions'][number]>;
  currentIndex: number;
  totalQuestions: number;
  currentResponse: ReturnType<typeof useExamEngine>['responses'][string] | undefined;
  engine: Pick<ReturnType<typeof useExamEngine>, 'setAnswer' | 'toggleReview'>;
  goToQuestion: (index: number) => void;
}) {
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const titaInputRef = useRef<HTMLInputElement>(null);

  const updateTitaAnswer = (nextValue: string) => {
    engine.setAnswer(currentQuestion.id, nextValue || null);
  };

  const moveTitaCaret = (direction: -1 | 1) => {
    const input = titaInputRef.current;
    if (!input) return;
    input.focus();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const position = direction < 0 ? Math.max(0, start - 1) : Math.min(input.value.length, end + 1);
    input.setSelectionRange(position, position);
  };

  return (
    <>
      <div className="exam-qa-scroll">
        <div className="exam-qmeta">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span className="exam-marks">
            <span className="exam-c">+{currentQuestion.marks}</span>
            {' / '}
            <span className="exam-w">-{currentQuestion.negative_marks}</span>
          </span>
        </div>

        <p className="exam-qtext">{currentQuestion.question_text}</p>

        {currentQuestion.image_url && (
          <img src={currentQuestion.image_url} alt="Question" className="exam-set-image-q" />
        )}

        {currentQuestion.question_type === 'MCQ' && currentQuestion.options ? (
          <div>
            {currentQuestion.options.map((option, idx) => {
              const selected = currentResponse?.selectedAnswer === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => engine.setAnswer(currentQuestion.id, option.id)}
                  className={`exam-option ${selected ? 'exam-selected' : ''}`}
                >
                  <span className="exam-oletter">{optionLetters[idx] ?? idx + 1}.</span>
                  <span>{option.text}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="exam-tita-wrap">
            <input
              ref={titaInputRef}
              type="text"
              value={currentResponse?.selectedAnswer ?? ''}
              onChange={(e) => updateTitaAnswer(e.target.value)}
              placeholder=""
              aria-label="Type your numerical answer"
              className="exam-tita-box"
            />
            <div className="exam-tita-keypad" aria-label="Virtual number keyboard">
              <button type="button" className="exam-tita-key exam-tita-key-wide" onClick={() => updateTitaAnswer((currentResponse?.selectedAnswer ?? '').slice(0, -1))}>Backspace</button>
              {['7,8,9', '4,5,6', '1,2,3', '0,.,-'].map((row) => (
                <div className="exam-tita-key-row" key={row}>
                  {row.split(',').map((key) => (
                    <button type="button" className="exam-tita-key" key={key} onClick={() => updateTitaAnswer((currentResponse?.selectedAnswer ?? '') + key)}>{key}</button>
                  ))}
                </div>
              ))}
              <div className="exam-tita-key-row">
                <button type="button" className="exam-tita-key" aria-label="Move cursor left" onClick={() => moveTitaCaret(-1)}>←</button>
                <button type="button" className="exam-tita-key" aria-label="Move cursor right" onClick={() => moveTitaCaret(1)}>→</button>
              </div>
              <button type="button" className="exam-tita-key exam-tita-key-wide" onClick={() => updateTitaAnswer('')}>Clear All</button>
            </div>
          </div>
        )}
      </div>

      <div className="exam-action-row">
        <button onClick={() => engine.setAnswer(currentQuestion.id, null)} className="exam-btn exam-btn-small">
          Clear Response
        </button>
        <button
          onClick={() => {
            engine.toggleReview(currentQuestion.id);
            goToQuestion(currentIndex + 1);
          }}
          className="exam-btn exam-btn-purple exam-btn-small"
        >
          <Flag className="w-3.5 h-3.5" />
          Mark for Review &amp; Next
        </button>
        <button
          onClick={() => goToQuestion(currentIndex + 1)}
          disabled={currentIndex === totalQuestions - 1}
          className="exam-btn exam-btn-green exam-btn-small"
        >
          Save &amp; Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="exam-nav-row">
        <button
          onClick={() => goToQuestion(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="exam-btn exam-btn-small"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <button
          onClick={() => goToQuestion(currentIndex + 1)}
          disabled={currentIndex === totalQuestions - 1}
          className="exam-btn exam-btn-small"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

export function TestInterface({ mockId, onNavigate }: Props) {
  const engine = useExamEngine({
    mockId,
    onSubmitted: (attemptId) => onNavigate({ name: 'results', attemptId }),
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const questionEnterTimeRef = useRef<number>(Date.now());

  // Reset to the first question whenever a new section's questions load.
  useEffect(() => {
    setCurrentIndex(0);
    questionEnterTimeRef.current = Date.now();
  }, [engine.currentSection]);

  const currentQuestion = engine.questions[currentIndex];
  const currentSet = currentQuestion?.set_id
    ? engine.questionSets.find((s) => s.id === currentQuestion.set_id)
    : undefined;
  const currentResponse = currentQuestion ? engine.responses[currentQuestion.id] : undefined;

  const recordElapsedOnCurrent = useCallback(() => {
    if (!currentQuestion) return;
    const elapsed = Math.round((Date.now() - questionEnterTimeRef.current) / 1000);
    if (elapsed > 0) engine.addTimeSpent(currentQuestion.id, elapsed);
    questionEnterTimeRef.current = Date.now();
  }, [currentQuestion, engine]);

  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= engine.questions.length) return;
      recordElapsedOnCurrent();
      setCurrentIndex(index);
      const target = engine.questions[index];
      if (target) engine.markVisited(target.id);
    },
    [engine, recordElapsedOnCurrent]
  );

  // Mark the first question of a freshly-loaded section visited.
  useEffect(() => {
    if (engine.phase === 'running' && currentQuestion) {
      engine.markVisited(currentQuestion.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase, engine.currentSection]);

  // Violation detection -- registered only while a section is
  // actually running, torn down otherwise.
  useEffect(() => {
    if (engine.phase !== 'running') return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        engine.recordViolation('tab_switch');
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        engine.recordViolation('fullscreen_exit');
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      engine.recordViolation('right_click');
    };

    const onCopyOrPaste = () => {
      engine.recordViolation('copy_paste');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopyOrPaste);
    document.addEventListener('paste', onCopyOrPaste);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopyOrPaste);
      document.removeEventListener('paste', onCopyOrPaste);
    };
  }, [engine.phase, engine]);

  // Flush time spent on the visible question the moment a submit
  // starts, so the last few seconds before the auto-submit aren't lost.
  useEffect(() => {
    if (engine.phase === 'submitting') {
      recordElapsedOnCurrent();
    }
  }, [engine.phase, recordElapsedOnCurrent]);

  // Fullscreen must be requested synchronously inside a user gesture,
  // before any `await` -- calling it as the first statement here
  // keeps it inside the click's gesture context.
  const handleStart = async () => {
    await requestFullscreenBestEffort();
    await engine.start();
  };

  /* ---------------------------------------------------------------- */

  if (engine.phase === 'loading') {
    return (
      <ExamShell>
        <div className="exam-centered">
          <div className="exam-loading">Loading...</div>
        </div>
      </ExamShell>
    );
  }

  if (engine.phase === 'not_started') {
    return (
      <ExamShell>
        <div className="exam-centered">
          <div className="exam-panel">
            <h2>Ready to begin?</h2>
            <p>
              The test has 3 timed sections -- VARC, DILR, and QA -- taken in order. Each section
              submits automatically the moment its timer ends. There is no manual submit and no
              way to pause once a section starts.
            </p>
            <button onClick={handleStart} className="exam-btn exam-btn-primary exam-btn-full">
              Start Test
            </button>
          </div>
        </div>
      </ExamShell>
    );
  }

  if (engine.phase === 'awaiting_start') {
    return (
      <ExamShell>
        <div className="exam-centered">
          <div className="exam-panel">
            <h2>{engine.currentSection ? SECTION_LABELS[engine.currentSection] : 'Next section'}</h2>
            <p>
              The previous section has been submitted. Click below when you're ready -- this
              section's timer starts the moment you do.
            </p>
            <button onClick={handleStart} className="exam-btn exam-btn-primary exam-btn-full">
              Start {engine.currentSection}
            </button>
          </div>
        </div>
      </ExamShell>
    );
  }

  if (engine.phase === 'session_conflict') {
    return (
      <ExamShell>
        <div className="exam-centered">
          <div className="exam-panel">
            <AlertCircle className="w-10 h-10" style={{ color: '#e8b93a', margin: '0 auto 12px' }} />
            <h2>Test in progress elsewhere</h2>
            <p>
              This test is currently active in another tab or browser. Only one can be active at
              a time.
            </p>
            <button
              onClick={() => onNavigate({ name: 'dashboard' })}
              className="exam-btn exam-btn-primary exam-btn-full"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </ExamShell>
    );
  }

  if (engine.phase === 'error') {
    return (
      <ExamShell>
        <div className="exam-centered">
          <div className="exam-panel">
            <AlertCircle className="w-10 h-10" style={{ color: '#cb4335', margin: '0 auto 12px' }} />
            <h2>Something went wrong</h2>
            <p>{engine.error}</p>
            <button
              onClick={() => onNavigate({ name: 'dashboard' })}
              className="exam-btn exam-btn-primary exam-btn-full"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </ExamShell>
    );
  }

  if (engine.phase === 'submitting' || engine.phase === 'finished') {
    return (
      <ExamShell>
        <div className="exam-centered">
          <div className="exam-loading">Submitting your answers...</div>
        </div>
      </ExamShell>
    );
  }

  if (engine.phase === 'transition') {
    return (
      <ExamShell>
        <TransitionScreen onAdvance={handleStart} />
      </ExamShell>
    );
  }

  // phase === 'running'
  if (!currentQuestion) {
    return (
      <ExamShell>
        <div className="exam-centered">
          <div className="exam-loading">No questions available for this section.</div>
        </div>
      </ExamShell>
    );
  }

  const hasPassage = !!(currentSet && (currentSet.passage_text || currentSet.passage_image_url));

  return (
    <ExamShell>
      <div className="exam-test-header">
        <div>
          <div className="exam-title">{engine.currentSection ? SECTION_LABELS[engine.currentSection] : ''}</div>
          <div className="exam-subtle">
            {engine.isSyncing ? 'Saving...' : engine.pendingCount > 0 ? 'Unsaved changes' : 'All changes saved'}
          </div>
        </div>
        <div className={`exam-timer-box ${engine.isWarning ? 'exam-low' : ''}`}>
          <Clock className="w-4 h-4" />
          {formatTime(engine.remainingSeconds)}
        </div>
      </div>

      <div className="exam-test-body">
        {hasPassage && (
          <div className="exam-passage-pane">
            <h3>Passage</h3>
            {currentSet!.passage_text && <p className="exam-ptext">{currentSet!.passage_text}</p>}
            {currentSet!.passage_image_url && (
              <img src={currentSet!.passage_image_url} alt="Passage" className="exam-set-image" />
            )}
          </div>
        )}

        <div className={`exam-qa-pane ${hasPassage ? '' : 'exam-full'}`}>
          <QuestionPanel
            currentQuestion={currentQuestion}
            currentIndex={currentIndex}
            totalQuestions={engine.questions.length}
            currentResponse={currentResponse}
            engine={engine}
            goToQuestion={goToQuestion}
          />
        </div>

        <div className="exam-palette-pane">
          <h4>Questions</h4>
          <div className="exam-palette-grid">
            {engine.questions.map((q, idx) => {
              const response = engine.responses[q.id];
              const answered = !!response?.selectedAnswer;
              const reviewed = !!response?.isMarkedForReview;
              const visited = !!response?.isVisited;
              const isCurrent = idx === currentIndex;

              let stateClass = 'exam-pal-not-visited';
              if (reviewed && answered) stateClass = 'exam-pal-answered-marked';
              else if (reviewed) stateClass = 'exam-pal-marked';
              else if (answered) stateClass = 'exam-pal-answered';
              else if (visited) stateClass = 'exam-pal-not-answered';

              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(idx)}
                  className={`exam-pal-btn ${stateClass} ${isCurrent ? 'exam-current' : ''}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="exam-legend">
            <div className="exam-row">
              <span className="exam-sw" style={{ background: 'var(--exam-green-answered)' }} />
              Answered
            </div>
            <div className="exam-row">
              <span className="exam-sw" style={{ background: 'var(--exam-red-not-answered)' }} />
              Not answered
            </div>
            <div className="exam-row">
              <span className="exam-sw" style={{ background: 'var(--exam-purple-marked)', borderRadius: '50%' }} />
              Marked for review
            </div>
            <div className="exam-row">
              <span
                className="exam-sw"
                style={{
                  background: 'var(--exam-purple-marked)',
                  borderRadius: '50%',
                  boxShadow: 'inset 0 0 0 2px var(--exam-green-answered)',
                }}
              />
              Answered &amp; marked
            </div>
            <div className="exam-row">
              <span className="exam-sw" style={{ background: 'var(--exam-grey-not-visited)' }} />
              Not visited
            </div>
          </div>

          {engine.pendingCount > 0 && (
            <div className="exam-sync-status">
              <ShieldAlert className="w-3.5 h-3.5" />
              {engine.pendingCount} change{engine.pendingCount === 1 ? '' : 's'} saving locally
            </div>
          )}
        </div>
      </div>
    </ExamShell>
  );
}