export type Role = 'student' | 'admin';

export type Section = 'VARC' | 'DILR' | 'QA';

// 'paused' removed: the product rule is "sections cannot be paused,"
// and the schema-catchup migration already dropped attempts.paused_at
// / total_paused_seconds and the resume-section function is retired.
export type AttemptStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted';

export type AttemptSectionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export type QuestionType = 'MCQ' | 'TITA';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GradingScope =
  | 'overall'
  | 'VARC'
  | 'DILR'
  | 'QA';

export type ViolationType =
  | 'tab_switch'
  | 'fullscreen_exit'
  | 'right_click'
  | 'copy_paste'
  | 'other';


/* ============================================================
   PROFILE
   ============================================================ */

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
}


/* ============================================================
   MOCK
   ============================================================ */

export interface Mock {
  id: string;
  title: string;
  description: string | null;

  is_published: boolean;

  section_duration_varc: number;
  section_duration_dilr: number;
  section_duration_qa: number;

  /**
   * Incremented when mock configuration/content changes.
   */
  version: number;

  /**
   * Optional mock-level configuration.
   */
  settings: Record<string, unknown>;

  /**
   * Optional scheduling window. Both nullable -- a mock with neither
   * set is available any time it's published.
   */
  available_from: string | null;
  available_until: string | null;

  /**
   * Admin-controlled freeze, toggled manually from the mock workspace
   * header. When true, AdminPanel disables editing the mock and its
   * questions/sets. Mirrors mocks.is_locked (add_mock_lock.sql).
   */
  is_locked: boolean;

  /**
   * NULL = solutions hidden from students. Set (instant toggle, not a
   * scheduler) to the moment the admin clicks "Release Solutions" in
   * the mock workspace header. get_solutions() only returns
   * correct_answer/solutions once this is set and in the past.
   */
  solutions_available_from: string | null;

  created_at: string;
  updated_at: string;
}


/* ============================================================
   MOCK ACCESS
   ============================================================ */

export interface MockAccess {
  id: string;
  mock_id: string;
  student_id: string;
  granted_at: string;
}


/* ============================================================
   QUESTION SET
   ============================================================ */

export interface QuestionSet {
  id: string;
  mock_id: string;

  section: Section;

  passage_text: string | null;
  passage_image_url: string | null;

  display_order: number;
}


/* ============================================================
   QUESTION OPTIONS
   ============================================================ */

export interface QuestionOption {
  id: string;
  text: string;
}


/* ============================================================
   ADMIN / SERVER QUESTION
   ============================================================ */

/**
 * Full question representation.
 *
 * IMPORTANT:
 * This type contains the answer key and therefore MUST NOT
 * be sent to the student browser, and is never returned by
 * enter_section() or get_review() -- the answer key is not shown to
 * students at any point, including after submission.
 */
export interface Question {
  id: string;
  mock_id: string;
  set_id: string | null;

  section: Section;

  display_order: number;

  question_type: QuestionType;

  question_text: string;

  image_url: string | null;

  options: QuestionOption[] | null;

  /**
   * SERVER ONLY
   */
  correct_answer: string;

  /**
   * SERVER ONLY
   */
  answer_tolerance: number;

  marks: number;
  negative_marks: number;

  difficulty: Difficulty | null;

  /**
   * Post-exam analytics -- admin-entered only (QuestionEditor), never
   * part of the JSON bulk import, never sent during the exam. Shown
   * on the results page's Area-Wise / Question-Wise / Question
   * Selection tabs only, after submission.
   */
  attempt_priority: 'A' | 'B' | 'C' | null;
  sub_topic: string | null;
  topper_time: string | null;
  topper_attempt_pct: number | null;
  topper_accuracy_pct: number | null;
  topper_p_value: number | null;

  /**
   * Overall-test-takers stats, same shape as topper_* but for
   * everyone who attempted, not just the topper. Optional -- unlike
   * the topper_* block, these aren't required to save a question.
   */
  overall_attempt_pct: number | null;
  overall_accuracy_pct: number | null;
  overall_time: string | null;
  overall_p_value: number | null;

  /**
   * Admin-entered solution links. Only ever sent to students by
   * get_solutions(), and only when the attempt is submitted and the
   * mock's solutions_available_from has passed.
   */
  solution_image_url: string | null;
  solution_video_url: string | null;

  version: number;

  created_at: string;
  updated_at: string;
}


/* ============================================================
   STUDENT QUESTION
   ============================================================ */

/**
 * Safe question representation sent to the student browser.
 *
 * NEVER add:
 * - correct_answer
 * - answer_tolerance
 *
 * to this interface.
 */
export interface StudentQuestion {
  id: string;
  mock_id: string;
  set_id: string | null;

  section: Section;

  display_order: number;

  question_type: QuestionType;

  question_text: string;

  image_url: string | null;

  options: QuestionOption[] | null;

  marks: number;
  negative_marks: number;

  difficulty: Difficulty | null;

  version: number;
}


/* ============================================================
   GRADING SHEET
   ============================================================ */

export interface GradingSheet {
  id: string;

  mock_id: string;

  scope: GradingScope;

  raw_marks: number;

  percentile: number | null;

  grade: string | null;
}


/* ============================================================
   ATTEMPT
   ============================================================ */

export interface Attempt {
  id: string;

  student_id: string;

  mock_id: string;

  status: AttemptStatus;

  current_section: Section | null;

  active_session_id: string | null;

  /**
   * Per-tab identity of whichever browser tab currently owns the
   * active session. Lets enter_section() hand the same session back
   * to a refreshing tab instead of rotating it, while a genuinely
   * different tab/device still triggers a takeover.
   */
  active_tab_id: string | null;

  section_started_at: string | null;

  section_ends_at: string | null;

  last_heartbeat_at: string | null;

  submitted_at: string | null;

  /**
   * Used for authoritative state synchronization.
   */
  state_version: number;

  /**
   * Last successful client -> server synchronization.
   */
  last_synced_at: string | null;

  created_at: string;
}


/* ============================================================
   ATTEMPT SECTION
   ============================================================ */

export interface AttemptSection {
  id: string;

  attempt_id: string;

  section: Section;

  /**
   * Server-authoritative start time.
   */
  started_at: string;

  /**
   * Server-authoritative deadline.
   */
  ends_at: string;

  completed_at: string | null;

  status: AttemptSectionStatus;
}


/* ============================================================
   RESPONSE
   ============================================================ */

export interface Response {
  id: string;

  attempt_id: string;

  question_id: string;

  selected_answer: string | null;

  is_marked_for_review: boolean;

  is_visited: boolean;

  time_spent_seconds: number;

  /**
   * Monotonic per-response sequence number set by the client and
   * enforced by sync_attempt()/submit_section() -- an older/slower
   * batch can never overwrite a newer answer already stored.
   */
  client_seq: number;

  /**
   * These are populated by the server after grading.
   *
   * They should not be trusted from the browser.
   */
  is_correct: boolean | null;

  marks_awarded: number | null;

  updated_at: string;
}


/* ============================================================
   CLIENT RESPONSE
   ============================================================ */

/**
 * Response state used by the exam UI.
 *
 * Unlike Response, this does not contain grading information.
 */
export interface StudentResponse {
  id: string | null;

  attempt_id: string;

  question_id: string;

  selected_answer: string | null;

  is_marked_for_review: boolean;

  is_visited: boolean;

  time_spent_seconds: number;

  updated_at: string;
}


/* ============================================================
   VIOLATIONS
   ============================================================ */

export interface Violation {
  id: string;

  attempt_id: string;

  type: ViolationType;

  section: Section | null;

  occurred_at: string;
}


/* ============================================================
   ATTEMPT RESULT
   ============================================================ */

export interface AttemptResult {
  id: string;

  attempt_id: string;

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
}


/* ============================================================
   SECTION CONSTANTS
   ============================================================ */

export const SECTION_ORDER: Section[] = [
  'VARC',
  'DILR',
  'QA',
];

export const SECTION_LABELS: Record<Section, string> = {
  VARC: 'Verbal Ability & Reading Comprehension',
  DILR: 'Data Interpretation & Logical Reasoning',
  QA: 'Quantitative Ability',
};

export const SECTION_SHORT: Record<Section, string> = {
  VARC: 'VARC',
  DILR: 'DILR',
  QA: 'QA',
};