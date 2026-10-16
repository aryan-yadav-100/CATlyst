import { supabase } from '@/lib/supabase';
import type { Section, ViolationType } from '@/types';

/* ============================================================
   TAB IDENTITY
   ============================================================
   Generated once per tab and kept in sessionStorage (not
   localStorage), so a second tab opened by the same student gets a
   DIFFERENT id, while a refresh of the SAME tab keeps the SAME id.
   This is what lets enter_section() hand the same session back to a
   refreshing tab instead of rotating it. */

const TAB_ID_KEY = 'catlyst_tab_id';

export function getTabId(): string {
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

/* ============================================================
   ERRORS
   ============================================================
   Every RPC RAISE EXCEPTIONs with a short UPPER_SNAKE_CASE code as
   the message. ApiError.code lets the caller branch on it without
   string-matching error.message everywhere. */

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'NO_ACCESS'
  | 'MOCK_NOT_AVAILABLE'
  | 'NOT_YET_AVAILABLE'
  | 'WINDOW_CLOSED'
  | 'MISSING_TAB_ID'
  | 'ATTEMPT_NOT_FOUND'
  | 'ATTEMPT_NOT_ACTIVE'
  | 'ALREADY_SUBMITTED'
  | 'SESSION_ENDED'
  | 'SESSION_REPLACED'
  | 'SECTION_EXPIRED'
  | 'NOT_SUBMITTED'
  | 'TOO_MANY_RESPONSES'
  | 'SOLUTIONS_NOT_RELEASED'
  | 'INVALID_SECTION'
  | 'UNKNOWN';

const KNOWN_CODES = new Set<string>([
  'UNAUTHORIZED', 'NO_ACCESS', 'MOCK_NOT_AVAILABLE', 'NOT_YET_AVAILABLE', 'WINDOW_CLOSED',
  'MISSING_TAB_ID', 'ATTEMPT_NOT_FOUND', 'ATTEMPT_NOT_ACTIVE', 'ALREADY_SUBMITTED',
  'SESSION_ENDED', 'SESSION_REPLACED', 'SECTION_EXPIRED', 'NOT_SUBMITTED', 'TOO_MANY_RESPONSES',
  'SOLUTIONS_NOT_RELEASED', 'INVALID_SECTION',
]);

export class ApiError extends Error {
  code: ApiErrorCode;

  constructor(rawMessage: string) {
    super(rawMessage);
    this.name = 'ApiError';
    this.code = (KNOWN_CODES.has(rawMessage) ? rawMessage : 'UNKNOWN') as ApiErrorCode;
  }
}

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  _retried = false
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    // A stale/expired access token is rejected by PostgREST before our
    // function body ever runs, and shows up as a generic auth error
    // rather than one of our own RAISE EXCEPTION codes. Refresh once
    // and retry so a token expiring mid-exam doesn't masquerade as a
    // real error and drop a dirty batch.
    //
    // Important: PostgREST returns HTTP 400 for EVERY RAISE EXCEPTION,
    // including our own expected ones (e.g. SECTION_EXPIRED, which
    // literally contains the substring "expired"). Those are never a
    // token problem -- checking KNOWN_CODES first stops a routine
    // SECTION_EXPIRED from triggering a pointless token refresh on
    // every single occurrence.
    const isOwnErrorCode = KNOWN_CODES.has(error.message ?? '');
    const looksLikeExpiredToken =
      !_retried &&
      !isOwnErrorCode &&
      (error.message?.toLowerCase().includes('jwt') ||
        error.message?.toLowerCase().includes('expired'));

    if (looksLikeExpiredToken) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) {
        return callRpc<T>(fn, args, true);
      }
    }

    throw new ApiError(error.message ?? 'UNKNOWN');
  }

  return data as T;
}

/* ============================================================
   get_dashboard
   ============================================================ */

export interface DashboardMockRow {
  mock: {
    id: string;
    title: string;
    description: string | null;
    section_duration_varc: number;
    section_duration_dilr: number;
    section_duration_qa: number;
    available_from: string | null;
    available_until: string | null;
  };
  attempt: {
    id: string;
    status: 'not_started' | 'in_progress' | 'submitted';
    current_section: Section | null;
    submitted_at: string | null;
  } | null;
}

export async function getDashboard(): Promise<{ mocks: DashboardMockRow[] }> {
  return callRpc('get_dashboard', {});
}

/* ============================================================
   enter_section
   ============================================================ */

export type ExamPhase = 'not_started' | 'awaiting_start' | 'running' | 'submitted';

export interface EnterSectionResponse {
  question_id: string;
  selected_answer: string | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  time_spent_seconds: number;
  client_seq: number;
  updated_at: string;
}

export interface EnterSectionResult {
  phase: ExamPhase;
  attempt_id?: string;
  session_id?: string;
  tab_id?: string;
  current_section?: Section;
  section_started_at?: string;
  section_ends_at?: string;
  server_now?: string;
  state_version?: number;
  question_sets?: Array<{
    id: string;
    section: Section;
    passage_text: string | null;
    passage_image_url: string | null;
    display_order: number;
  }>;
  questions?: Array<{
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
  }>;
  responses?: EnterSectionResponse[];
}

/**
 * The single call made on every page load.
 *
 * start = false: pure read, no side effects. Use this on mount/refresh
 * so a reload never silently starts the next section's timer.
 *
 * start = true: creates or reuses the session. Use this only from an
 * explicit user action (the transition screen's "Start <Section>"
 * button, or first entry into the exam).
 */
export async function enterSection(mockId: string, start: boolean): Promise<EnterSectionResult> {
  return callRpc('enter_section', {
    p_mock_id: mockId,
    p_tab_id: getTabId(),
    p_start: start,
  });
}

/* ============================================================
   sync_attempt / submit_section (shared shapes)
   ============================================================ */

export interface SyncResponseItem {
  question_id: string;
  selected_answer: string | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  time_spent_seconds: number;
  client_seq: number;
}

export interface SyncViolationItem {
  client_id: string;
  type: ViolationType;
  section: Section | null;
  occurred_at: string;
}

export interface SyncResult {
  accepted_question_ids: string[];
  rejected: Array<{ question_id: string; reason: string }>;
  section_ends_at: string;
  server_now: string;
}

/**
 * Carries answers + violations together. No separate heartbeat call --
 * this response's section_ends_at/server_now doubles as the
 * "still current" signal a heartbeat would have provided, at zero
 * extra cost since it rides on a call already being made.
 *
 * Only call this when there is something dirty to send.
 */
export async function syncAttempt(
  attemptId: string,
  sessionId: string,
  responses: SyncResponseItem[],
  violations: SyncViolationItem[]
): Promise<SyncResult> {
  return callRpc('sync_attempt', {
    p_attempt_id: attemptId,
    p_session_id: sessionId,
    p_responses: responses,
    p_violations: violations,
  });
}

export interface SubmitSectionResult {
  advanced: boolean;
  submitted: boolean;
  next_section?: Section;
  section_marks?: number;
  attempt_id: string;
  retried?: boolean;
}

/**
 * Called only when the section's own timer reaches zero (there is no
 * manual submit button). Carries the final dirty batch in the SAME
 * call that grades and advances -- there is no separate "sync, then
 * submit" gap where a failure between the two could lose the last
 * answers.
 */
export async function submitSection(
  attemptId: string,
  sessionId: string,
  responses: SyncResponseItem[],
  violations: SyncViolationItem[]
): Promise<SubmitSectionResult> {
  return callRpc('submit_section', {
    p_attempt_id: attemptId,
    p_session_id: sessionId,
    p_responses: responses,
    p_violations: violations,
  });
}

/* ============================================================
   get_review
   ============================================================ */

export interface ReviewResult {
  mock_title: string | null;
  submitted_at: string | null;
  result: {
    overall_raw_marks: number;
    overall_percentile: number | null;
    overall_grade: string | null;
    varc_raw_marks: number | null;
    varc_percentile: number | null;
    dilr_raw_marks: number | null;
    dilr_percentile: number | null;
    qa_raw_marks: number | null;
    qa_percentile: number | null;
    accuracy_overall: number | null;
    computed_at: string;
  } | null;
  responses: Array<{
    question_id: string;
    section: Section;
    display_order: number;
    question_text: string;
    selected_answer: string | null;
    is_correct: boolean | null;
    marks_awarded: number | null;
    time_spent_seconds: number;
    attempt_priority: 'A' | 'B' | 'C' | null;
    sub_topic: string | null;
    topper_time: string | null;
    topper_attempt_pct: number | null;
    topper_accuracy_pct: number | null;
    topper_p_value: number | null;
  }>;
  violations_count: number;
}

/** Never includes correct_answer or answer_tolerance -- the answer key
 * is not shown to students, before or after submission. */
export async function getReview(attemptId: string): Promise<ReviewResult> {
  return callRpc('get_review', { p_attempt_id: attemptId });
}

/* ============================================================
   get_solutions
   ============================================================
   Separate from get_review() on purpose. This is the ONLY call that
   ever returns correct_answer to a student, and only once the
   attempt is submitted AND the mock's solutions have been released
   by the admin (SOLUTIONS_NOT_RELEASED otherwise). One call per
   section -- the caller should cache each section's result and only
   re-fetch when switching to a section not yet loaded. */

export interface SolutionQuestionSet {
  id: string;
  passage_text: string | null;
  passage_image_url: string | null;
  display_order: number;
}

export interface SolutionQuestion {
  id: string;
  set_id: string | null;
  display_order: number;
  question_type: 'MCQ' | 'TITA';
  question_text: string;
  image_url: string | null;
  options: { id: string; text: string }[] | null;
  marks: number;
  negative_marks: number;
  correct_answer: string;
  attempt_priority: 'A' | 'B' | 'C' | null;
  sub_topic: string | null;
  topper_time: string | null;
  topper_attempt_pct: number | null;
  topper_accuracy_pct: number | null;
  topper_p_value: number | null;
  overall_time: string | null;
  overall_attempt_pct: number | null;
  overall_accuracy_pct: number | null;
  overall_p_value: number | null;
  solution_image_url: string | null;
  solution_video_url: string | null;
  selected_answer: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  time_spent_seconds: number;
}

export interface SolutionsResult {
  section: Section;
  question_sets: SolutionQuestionSet[];
  questions: SolutionQuestion[];
}

export async function getSolutions(attemptId: string, section: Section): Promise<SolutionsResult> {
  return callRpc('get_solutions', { p_attempt_id: attemptId, p_section: section });
}