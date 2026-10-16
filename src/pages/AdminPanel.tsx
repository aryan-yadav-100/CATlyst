import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap, LogOut, BookOpen, Users, FileText, Plus, Edit2, Trash2,
  X, AlertCircle, Upload, ChevronDown, ChevronRight, Clock, Award, BarChart3,
  Search, CheckCircle2, Lock, Unlock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Mock, Profile, Question, QuestionSet, GradingSheet, MockAccess, Section, QuestionType, Difficulty, GradingScope } from '@/types';
import { SECTION_ORDER } from '@/types';
import type { Route } from '@/App';

type AdminView = 'workspace' | 'students';
type WorkspaceTab = 'questions' | 'access' | 'grading';

export function AdminPanel({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<AdminView>('workspace');
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [selectedMockId, setSelectedMockId] = useState<string | null>(null);
  const [loadingMocks, setLoadingMocks] = useState(true);
  const [mockEditorTarget, setMockEditorTarget] = useState<Mock | 'new' | null>(null);
  const [deleteConfirmMock, setDeleteConfirmMock] = useState<Mock | null>(null);
  const [deleteMockError, setDeleteMockError] = useState<string | null>(null);
  const [deletingMock, setDeletingMock] = useState(false);

  const fetchMocks = useCallback(async () => {
    setLoadingMocks(true);
    const { data } = await supabase.from('mocks').select('*').order('created_at', { ascending: false });
    setMocks((data as Mock[]) || []);
    setLoadingMocks(false);
  }, []);

  useEffect(() => {
    fetchMocks();
  }, [fetchMocks]);

  const selectedMock = mocks.find((m) => m.id === selectedMockId) || null;

  const handleMockSaved = (savedMockId: string) => {
    setMockEditorTarget(null);
    setSelectedMockId(savedMockId);
    fetchMocks();
  };

  const handleDeleteMock = async () => {
    if (!deleteConfirmMock) return;
    setDeletingMock(true);
    setDeleteMockError(null);
    const { error } = await supabase.from('mocks').delete().eq('id', deleteConfirmMock.id);
    setDeletingMock(false);
    if (error) {
      setDeleteMockError(error.message);
      return;
    }
    if (selectedMockId === deleteConfirmMock.id) setSelectedMockId(null);
    setDeleteConfirmMock(null);
    fetchMocks();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Admin Panel</h1>
              <p className="text-xs text-neutral-500">CAT Mock Test Management</p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
            <button
              onClick={() => setView('workspace')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === 'workspace' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Workspace
            </button>
            <button
              onClick={() => setView('students')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === 'students' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              All Students
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-secondary text-sm">
              Student View
            </button>
            <button onClick={signOut} className="btn-ghost p-2" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {view === 'students' ? (
          <StudentsTab />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="lg:w-72 flex-shrink-0">
              <MockRail
                mocks={mocks}
                loading={loadingMocks}
                selectedMockId={selectedMockId}
                onSelect={setSelectedMockId}
                onNew={() => setMockEditorTarget('new')}
              />
            </aside>

            <main className="flex-1 min-w-0">
              {loadingMocks ? (
                <div className="card p-12 text-center text-neutral-400">Loading...</div>
              ) : !selectedMock ? (
                <div className="card p-12 text-center">
                  <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500 mb-4">
                    {mocks.length === 0
                      ? 'No mock tests yet. Create one to get started.'
                      : 'Select a mock test from the list to manage it.'}
                  </p>
                  <button onClick={() => setMockEditorTarget('new')} className="btn-primary mx-auto">
                    <Plus className="w-4 h-4" />
                    New Mock
                  </button>
                </div>
              ) : (
                <MockWorkspace
                  mock={selectedMock}
                  onEdit={() => setMockEditorTarget(selectedMock)}
                  onDelete={() => setDeleteConfirmMock(selectedMock)}
                  onPublishToggled={fetchMocks}
                />
              )}
            </main>
          </div>
        )}
      </div>

      {mockEditorTarget && (
        <MockEditorModal
          mock={mockEditorTarget === 'new' ? null : mockEditorTarget}
          onClose={() => setMockEditorTarget(null)}
          onSaved={handleMockSaved}
        />
      )}

      {deleteConfirmMock && (
        <DeleteConfirmModal
          title="Delete Mock Test"
          message={`Are you sure you want to delete "${deleteConfirmMock.title}"? This will also delete all questions, grading sheets, and access for this mock. This cannot be undone.`}
          error={deleteMockError}
          confirming={deletingMock}
          onCancel={() => { setDeleteConfirmMock(null); setDeleteMockError(null); }}
          onConfirm={handleDeleteMock}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// MOCK RAIL (left sidebar list of mocks)
// ═══════════════════════════════════════════
function MockRail({
  mocks, loading, selectedMockId, onSelect, onNew,
}: {
  mocks: Mock[];
  loading: boolean;
  selectedMockId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? mocks.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    : mocks;

  return (
    <div className="card p-3 sticky top-20">
      <button onClick={onNew} className="btn-primary w-full mb-3">
        <Plus className="w-4 h-4" />
        New Mock
      </button>

      {mocks.length > 3 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mocks..."
            className="input pl-8 text-sm py-1.5"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-neutral-400 text-center py-6">
          {mocks.length === 0 ? 'No mocks yet.' : 'No mocks match your search.'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[65vh] overflow-y-auto">
          {filtered.map((mock) => {
            const totalMin = Math.round(
              (mock.section_duration_varc + mock.section_duration_dilr + mock.section_duration_qa) / 60
            );
            const isSelected = selectedMockId === mock.id;
            return (
              <button
                key={mock.id}
                onClick={() => onSelect(mock.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                  isSelected ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary-800' : 'text-neutral-800'}`}>
                    {mock.title}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {mock.is_published ? (
                    <span className="badge-success text-[10px] px-1.5 py-0">Published</span>
                  ) : (
                    <span className="badge-neutral text-[10px] px-1.5 py-0">Draft</span>
                  )}
                  <span className="text-[11px] text-neutral-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {totalMin}m
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// MOCK WORKSPACE (header + sub-tabs for one selected mock)
// ═══════════════════════════════════════════
function MockWorkspace({
  mock, onEdit, onDelete, onPublishToggled,
}: {
  mock: Mock;
  onEdit: () => void;
  onDelete: () => void;
  onPublishToggled: () => void;
}) {
  const [tab, setTab] = useState<WorkspaceTab>('questions');
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [togglingLock, setTogglingLock] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [togglingSolutions, setTogglingSolutions] = useState(false);
  const [solutionsError, setSolutionsError] = useState<string | null>(null);
  const [showHideSolutionsConfirm, setShowHideSolutionsConfirm] = useState(false);

  const locked = mock.is_locked ?? false;
  const solutionsReleased =
    !!mock.solutions_available_from && new Date(mock.solutions_available_from).getTime() <= Date.now();

  const handleTogglePublish = async () => {
    setTogglingPublish(true);
    setPublishError(null);
    const { error } = await supabase.from('mocks').update({ is_published: !mock.is_published }).eq('id', mock.id);
    setTogglingPublish(false);
    if (error) {
      setPublishError(error.message);
      return;
    }
    onPublishToggled();
  };

  const handleLock = async () => {
    setTogglingLock(true);
    setLockError(null);
    const { error } = await supabase.from('mocks').update({ is_locked: true }).eq('id', mock.id);
    setTogglingLock(false);
    if (error) {
      setLockError(error.message);
      return;
    }
    onPublishToggled();
  };

  const handleUnlock = async () => {
    setTogglingLock(true);
    setLockError(null);
    const { error } = await supabase.from('mocks').update({ is_locked: false }).eq('id', mock.id);
    setTogglingLock(false);
    if (error) {
      setLockError(error.message);
      return;
    }
    setShowUnlockConfirm(false);
    onPublishToggled();
  };

  const handleReleaseSolutions = async () => {
    setTogglingSolutions(true);
    setSolutionsError(null);
    const { error } = await supabase
      .from('mocks')
      .update({ solutions_available_from: new Date().toISOString() })
      .eq('id', mock.id);
    setTogglingSolutions(false);
    if (error) {
      setSolutionsError(error.message);
      return;
    }
    onPublishToggled();
  };

  const handleHideSolutions = async () => {
    setTogglingSolutions(true);
    setSolutionsError(null);
    const { error } = await supabase
      .from('mocks')
      .update({ solutions_available_from: null })
      .eq('id', mock.id);
    setTogglingSolutions(false);
    if (error) {
      setSolutionsError(error.message);
      return;
    }
    setShowHideSolutionsConfirm(false);
    onPublishToggled();
  };

  return (
    <div>
      {/* Workspace header */}
      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-neutral-900 truncate">{mock.title}</h2>
              {mock.is_published ? (
                <span className="badge-success">Published</span>
              ) : (
                <span className="badge-neutral">Draft</span>
              )}
              {locked && (
                <span className="badge bg-neutral-800 text-white flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Locked
                </span>
              )}
              {solutionsReleased && (
                <span className="badge-success flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Solutions Released
                </span>
              )}
            </div>
            {mock.description && <p className="text-sm text-neutral-500 mb-2">{mock.description}</p>}
            <div className="flex items-center gap-4 text-xs text-neutral-400">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />VARC {Math.round(mock.section_duration_varc / 60)}m</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />DILR {Math.round(mock.section_duration_dilr / 60)}m</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />QA {Math.round(mock.section_duration_qa / 60)}m</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {locked ? (
              <button
                onClick={() => setShowUnlockConfirm(true)}
                disabled={togglingLock}
                className="btn-secondary text-sm"
              >
                <Unlock className="w-3.5 h-3.5" />
                Unlock to Edit
              </button>
            ) : (
              <button onClick={handleLock} disabled={togglingLock} className="btn-secondary text-sm">
                <Lock className="w-3.5 h-3.5" />
                {togglingLock ? 'Working...' : 'Lock'}
              </button>
            )}
            <button
              onClick={handleTogglePublish}
              disabled={togglingPublish}
              className={mock.is_published ? 'btn-danger text-sm' : 'btn-success text-sm'}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {togglingPublish ? 'Working...' : mock.is_published ? 'Unpublish' : 'Publish'}
            </button>
            {solutionsReleased ? (
              <button
                onClick={() => setShowHideSolutionsConfirm(true)}
                disabled={togglingSolutions}
                className="btn-secondary text-sm"
              >
                Hide Solutions
              </button>
            ) : (
              <button
                onClick={handleReleaseSolutions}
                disabled={togglingSolutions}
                className="btn-secondary text-sm"
              >
                {togglingSolutions ? 'Working...' : 'Release Solutions'}
              </button>
            )}
            <button
              onClick={onEdit}
              disabled={locked}
              className="btn-secondary p-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title={locked ? 'Unlock the mock to edit its details' : 'Edit mock details'}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              disabled={locked}
              className="btn-secondary p-2 text-error-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title={locked ? 'Unlock the mock to delete it' : 'Delete mock'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(publishError || lockError || solutionsError) && (
          <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg mt-4">
            <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-error-700">{publishError || lockError || solutionsError}</p>
          </div>
        )}

        {solutionsReleased && (
          <div className="flex items-start gap-2 p-3 bg-success-50 border border-success-200 rounded-lg mt-4">
            <CheckCircle2 className="w-4 h-4 text-success-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-success-700">
              Solutions are visible to any student whose attempt is submitted. Released{' '}
              {mock.solutions_available_from && new Date(mock.solutions_available_from).toLocaleString()}.
            </p>
          </div>
        )}

        {locked && (
          <div className="flex items-start gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-lg mt-4">
            <Lock className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-neutral-600">
              This mock is locked. Questions, sets, and mock details can't be changed until you unlock it.
              Student access and grading sheets are still editable.
            </p>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-5 w-fit">
        {[
          { key: 'questions', label: 'Sections & Questions', icon: FileText },
          { key: 'access', label: 'Student Access', icon: Users },
          { key: 'grading', label: 'Grading Sheets', icon: Award },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as WorkspaceTab)}
              className={`flex items-center gap-2 py-1.5 px-4 rounded-md text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'questions' && <QuestionsTab mock={mock} locked={locked} />}
      {tab === 'access' && <AccessTab mock={mock} />}
      {tab === 'grading' && <GradingTab mock={mock} />}

      {showUnlockConfirm && (
        <DeleteConfirmModal
          title="Unlock this mock?"
          message="You'll be able to edit questions, answers, and section durations again. If students already have access or attempts in progress, changing content now can affect their results -- re-lock when you're done."
          tone="warning"
          confirmLabel="Unlock"
          confirming={togglingLock}
          error={lockError}
          onCancel={() => setShowUnlockConfirm(false)}
          onConfirm={handleUnlock}
        />
      )}

      {showHideSolutionsConfirm && (
        <DeleteConfirmModal
          title="Hide solutions again?"
          message="Students who already have the review page open may have seen the answers. This only prevents anyone from opening it from now on -- it doesn't undo anything already seen."
          tone="warning"
          confirmLabel="Hide Solutions"
          confirming={togglingSolutions}
          error={solutionsError}
          onCancel={() => setShowHideSolutionsConfirm(false)}
          onConfirm={handleHideSolutions}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// MOCK EDITOR (modal, used for both new + edit)
// ═══════════════════════════════════════════
function MockEditorModal({
  mock, onClose, onSaved,
}: {
  mock: Mock | null;
  onClose: () => void;
  onSaved: (mockId: string) => void;
}) {
  const [title, setTitle] = useState(mock?.title || '');
  const [description, setDescription] = useState(mock?.description || '');
  const [varcDuration, setVarcDuration] = useState(mock ? Math.round(mock.section_duration_varc / 60) : 40);
  const [dilrDuration, setDilrDuration] = useState(mock ? Math.round(mock.section_duration_dilr / 60) : 40);
  const [qaDuration, setQaDuration] = useState(mock ? Math.round(mock.section_duration_qa / 60) : 40);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const data = {
        title,
        description: description || null,
        section_duration_varc: varcDuration * 60,
        section_duration_dilr: dilrDuration * 60,
        section_duration_qa: qaDuration * 60,
      };

      if (mock) {
        const { error } = await supabase.from('mocks').update(data).eq('id', mock.id);
        if (error) throw error;
        onSaved(mock.id);
      } else {
        const { data: newMock, error } = await supabase.from('mocks').insert(data).select('id').single();
        if (error) throw error;
        onSaved(newMock.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
      <div className="card p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-neutral-900">{mock ? 'Edit Mock' : 'New Mock'}</h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Mock Test 1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-[80px]" placeholder="A brief description of this mock test" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">VARC (min)</label>
              <input type="number" value={varcDuration} onChange={(e) => setVarcDuration(Number(e.target.value))} className="input" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">DILR (min)</label>
              <input type="number" value={dilrDuration} onChange={(e) => setDilrDuration(Number(e.target.value))} className="input" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">QA (min)</label>
              <input type="number" value={qaDuration} onChange={(e) => setQaDuration(Number(e.target.value))} className="input" min="1" />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving || !title} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// QUESTIONS TAB (scoped to one mock)
// ═══════════════════════════════════════════
function QuestionsTab({ mock, locked }: { mock: Mock; locked: boolean }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('VARC');
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const { data: qData } = await supabase
      .from('questions')
      .select('*')
      .eq('mock_id', mock.id)
      .order('section', { ascending: true })
      .order('display_order', { ascending: true });
    setQuestions((qData as Question[]) || []);

    const { data: setData } = await supabase
      .from('question_sets')
      .select('*')
      .eq('mock_id', mock.id)
      .order('display_order', { ascending: true });
    setQuestionSets((setData as QuestionSet[]) || []);
    setLoading(false);
  }, [mock.id]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const sectionQuestions = questions.filter((q) => q.section === activeSection);
  const sectionSets = questionSets.filter((s) => s.section === activeSection);
  const standaloneQuestions = sectionQuestions.filter((q) => !q.set_id);

  const toggleSet = (setId: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  };

  if (showImport) {
    return (
      <ImportQuestionsModal
        mock={mock}
        existingSets={questionSets}
        existingQuestions={questions}
        onClose={() => setShowImport(false)}
        onImported={() => { setShowImport(false); fetchQuestions(); }}
      />
    );
  }

  if (showEditor) {
    return (
      <QuestionEditor
        mock={mock}
        question={editingQuestion}
        questionSets={questionSets}
        onClose={() => { setShowEditor(false); setEditingQuestion(null); }}
        onSaved={() => { setShowEditor(false); setEditingQuestion(null); fetchQuestions(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">Sections &amp; Questions</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            disabled={locked}
            className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            title={locked ? 'Unlock the mock to import questions' : undefined}
          >
            <Upload className="w-4 h-4" />
            Import JSON
          </button>
          <button
            onClick={() => { setEditingQuestion(null); setShowEditor(true); }}
            disabled={locked}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            title={locked ? 'Unlock the mock to add questions' : undefined}
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>
      </div>

      {/* Section selector */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-4 w-fit">
        {SECTION_ORDER.map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            className={`py-1.5 px-4 rounded-md text-sm font-medium transition-all ${
              activeSection === sec ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {sec}
            <span className="ml-1.5 text-xs text-neutral-400">
              ({questions.filter((q) => q.section === sec).length})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : sectionQuestions.length === 0 && sectionSets.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No questions in {activeSection} yet. Add one, or import a JSON set.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Grouped by sets */}
          {sectionSets.map((set) => {
            const setQuestions = sectionQuestions.filter((q) => q.set_id === set.id);
            const isExpanded = expandedSets.has(set.id);
            return (
              <div key={set.id} className="card overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-neutral-50 flex items-center gap-3"
                  onClick={() => toggleSet(set.id)}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-700">
                      Set {set.display_order + 1} — {set.passage_text?.slice(0, 80) || 'No passage'}{set.passage_text && set.passage_text.length > 80 ? '...' : ''}
                    </p>
                    <p className="text-xs text-neutral-400">{setQuestions.length} questions</p>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-neutral-100">
                    {setQuestions.map((q, idx) => (
                      <QuestionRow key={q.id} question={q} index={idx} locked={locked} onEdit={() => { setEditingQuestion(q); setShowEditor(true); }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone questions */}
          {standaloneQuestions.map((q, idx) => (
            <div key={q.id} className="card">
              <QuestionRow question={q} index={idx} locked={locked} onEdit={() => { setEditingQuestion(q); setShowEditor(true); }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// BULK JSON IMPORT
// ═══════════════════════════════════════════
//
// Schema:
// {
//   "section": "VARC" | "DILR" | "QA",
//   "sets": [                          -- optional, for passage/data-set questions
//     {
//       "passage_text": "...",         -- nullable
//       "passage_image_url": "...",    -- nullable
//       "questions": [ <question>, ... ]
//     }
//   ],
//   "questions": [ <question>, ... ]   -- optional, standalone (no passage/set)
// }
//
// <question> shape:
// {
//   "question_type": "MCQ" | "TITA",
//   "question_text": "...",
//   "image_url": null,
//   "options": [ { "id": "A", "text": "..." }, ... ],   -- required for MCQ, omit for TITA
//   "correct_answer": "A",
//   "answer_tolerance": 0,             -- optional, TITA only, defaults to 0
//   "marks": 3,                        -- optional, defaults to 3
//   "negative_marks": 1,               -- optional, defaults to 1
//   "difficulty": "medium"             -- optional: easy | medium | hard | null
// }

interface ImportQuestionInput {
  question_type: QuestionType;
  question_text: string;
  image_url: string | null;
  options: { id: string; text: string }[] | null;
  correct_answer: string;
  answer_tolerance: number;
  marks: number;
  negative_marks: number;
  difficulty: Difficulty | null;
}

interface ImportSetInput {
  passage_text: string | null;
  passage_image_url: string | null;
  questions: ImportQuestionInput[];
}

interface ParsedImport {
  section: Section;
  sets: ImportSetInput[];
  standaloneQuestions: ImportQuestionInput[];
}

function validateQuestion(raw: any, label: string, errors: string[]): ImportQuestionInput | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${label}: not an object`);
    return null;
  }
  if (raw.question_type !== 'MCQ' && raw.question_type !== 'TITA') {
    errors.push(`${label}: question_type must be "MCQ" or "TITA"`);
    return null;
  }
  if (typeof raw.question_text !== 'string' || raw.question_text.trim() === '') {
    errors.push(`${label}: question_text is required`);
    return null;
  }
  if (typeof raw.correct_answer !== 'string' || raw.correct_answer.trim() === '') {
    errors.push(`${label}: correct_answer is required`);
    return null;
  }

  let options: { id: string; text: string }[] | null = null;
  if (raw.question_type === 'MCQ') {
    if (!Array.isArray(raw.options) || raw.options.length === 0) {
      errors.push(`${label}: MCQ questions require a non-empty "options" array`);
      return null;
    }
    for (const opt of raw.options) {
      if (!opt || typeof opt.id !== 'string' || typeof opt.text !== 'string') {
        errors.push(`${label}: each option needs a string "id" and "text"`);
        return null;
      }
    }
    options = raw.options;
    if (!options!.some((o) => o.id === raw.correct_answer)) {
      errors.push(`${label}: correct_answer "${raw.correct_answer}" does not match any option id`);
      return null;
    }
  }

  if (raw.difficulty && !['easy', 'medium', 'hard'].includes(raw.difficulty)) {
    errors.push(`${label}: difficulty must be easy, medium, hard, or omitted`);
    return null;
  }

  return {
    question_type: raw.question_type,
    question_text: raw.question_text,
    image_url: typeof raw.image_url === 'string' ? raw.image_url : null,
    options,
    correct_answer: raw.correct_answer,
    answer_tolerance: typeof raw.answer_tolerance === 'number' ? raw.answer_tolerance : 0,
    marks: typeof raw.marks === 'number' ? raw.marks : 3,
    negative_marks: typeof raw.negative_marks === 'number' ? raw.negative_marks : 1,
    difficulty: raw.difficulty ?? null,
  };
}

/** Validates the whole payload up front. Returns errors only if something
 * is wrong -- nothing is written to the database unless this list is empty. */
function validateImportPayload(raw: any): { data: ParsedImport | null; errors: string[] } {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { data: null, errors: ['Root value must be a JSON object'] };
  }
  if (!SECTION_ORDER.includes(raw.section)) {
    return { data: null, errors: ['"section" must be one of VARC, DILR, QA'] };
  }

  const sets: ImportSetInput[] = [];
  if (raw.sets !== undefined) {
    if (!Array.isArray(raw.sets)) {
      errors.push('"sets" must be an array if present');
    } else {
      raw.sets.forEach((rawSet: any, setIdx: number) => {
        if (!rawSet || typeof rawSet !== 'object') {
          errors.push(`Set ${setIdx + 1}: not an object`);
          return;
        }
        if (!Array.isArray(rawSet.questions) || rawSet.questions.length === 0) {
          errors.push(`Set ${setIdx + 1}: needs a non-empty "questions" array`);
          return;
        }
        const questions: ImportQuestionInput[] = [];
        rawSet.questions.forEach((rawQ: any, qIdx: number) => {
          const parsed = validateQuestion(rawQ, `Set ${setIdx + 1}, Question ${qIdx + 1}`, errors);
          if (parsed) questions.push(parsed);
        });
        sets.push({
          passage_text: typeof rawSet.passage_text === 'string' ? rawSet.passage_text : null,
          passage_image_url: typeof rawSet.passage_image_url === 'string' ? rawSet.passage_image_url : null,
          questions,
        });
      });
    }
  }

  const standaloneQuestions: ImportQuestionInput[] = [];
  if (raw.questions !== undefined) {
    if (!Array.isArray(raw.questions)) {
      errors.push('"questions" must be an array if present');
    } else {
      raw.questions.forEach((rawQ: any, qIdx: number) => {
        const parsed = validateQuestion(rawQ, `Standalone Question ${qIdx + 1}`, errors);
        if (parsed) standaloneQuestions.push(parsed);
      });
    }
  }

  if (sets.length === 0 && standaloneQuestions.length === 0) {
    errors.push('Nothing to import -- provide "sets" and/or "questions"');
  }

  if (errors.length > 0) return { data: null, errors };
  return { data: { section: raw.section, sets, standaloneQuestions }, errors: [] };
}

function downloadTemplate(section: Section) {
  const template = {
    section,
    sets: [
      {
        passage_text: 'Paste the passage or data-set text here. Omit or set to null if this set has an image instead.',
        passage_image_url: null,
        questions: [
          {
            question_type: 'MCQ',
            question_text: 'Question text goes here.',
            image_url: null,
            options: [
              { id: 'A', text: 'Option A' },
              { id: 'B', text: 'Option B' },
              { id: 'C', text: 'Option C' },
              { id: 'D', text: 'Option D' },
            ],
            correct_answer: 'B',
            marks: 3,
            negative_marks: 1,
            difficulty: 'medium',
          },
        ],
      },
    ],
    questions: [
      {
        question_type: 'TITA',
        question_text: 'A standalone question with no passage, e.g. a QA question.',
        image_url: null,
        options: null,
        correct_answer: '42',
        answer_tolerance: 0.5,
        marks: 3,
        negative_marks: 0,
        difficulty: 'easy',
      },
    ],
  };

  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `question-import-template-${section.toLowerCase()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function ImportQuestionsModal({
  mock, existingSets, existingQuestions, onClose, onImported,
}: {
  mock: Mock;
  existingSets: QuestionSet[];
  existingQuestions: Question[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    insertedSets: number;
    insertedQuestions: number;
    failures: string[];
  } | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setJsonText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setErrors([]);
    setResult(null);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setErrors(['That is not valid JSON. Check for a trailing comma or unmatched bracket.']);
      return;
    }

    const { data, errors: validationErrors } = validateImportPayload(parsed);
    if (!data) {
      setErrors(validationErrors);
      return;
    }

    setIsImporting(true);
    const failures: string[] = [];

    const sectionSets = existingSets.filter((s) => s.section === data.section);
    const sectionQuestions = existingQuestions.filter((q) => q.section === data.section);
    let nextSetOrder = sectionSets.length
      ? Math.max(...sectionSets.map((s) => s.display_order)) + 1
      : 0;
    let nextQuestionOrder = sectionQuestions.length
      ? Math.max(...sectionQuestions.map((q) => q.display_order)) + 1
      : 0;

    const questionRows: Record<string, unknown>[] = [];
    let insertedSets = 0;
    // Set ids inserted this run, so a downstream questions-batch failure
    // can be cleaned up instead of leaving orphaned empty sets behind.
    const insertedSetIds: string[] = [];

    // Sets are inserted one at a time (not batched) so each insert's
    // returned id is unambiguously correlated to that set's own
    // questions -- a small number of extra requests for the admin,
    // in exchange for never risking a question landing under the
    // wrong set.
    for (let i = 0; i < data.sets.length; i++) {
      const set = data.sets[i];
      const { data: setRow, error: setError } = await supabase
        .from('question_sets')
        .insert({
          mock_id: mock.id,
          section: data.section,
          passage_text: set.passage_text,
          passage_image_url: set.passage_image_url,
          display_order: nextSetOrder++,
        })
        .select('id')
        .single();

      if (setError || !setRow) {
        failures.push(`Set ${i + 1}: failed to save (${setError?.message ?? 'unknown error'}) -- its questions were skipped.`);
        continue;
      }

      insertedSets++;
      insertedSetIds.push(setRow.id);
      for (const q of set.questions) {
        questionRows.push({
          mock_id: mock.id,
          set_id: setRow.id,
          section: data.section,
          display_order: nextQuestionOrder++,
          question_type: q.question_type,
          question_text: q.question_text,
          image_url: q.image_url,
          options: q.options,
          correct_answer: q.correct_answer,
          answer_tolerance: q.answer_tolerance,
          marks: q.marks,
          negative_marks: q.negative_marks,
          difficulty: q.difficulty,
        });
      }
    }

    for (const q of data.standaloneQuestions) {
      questionRows.push({
        mock_id: mock.id,
        set_id: null,
        section: data.section,
        display_order: nextQuestionOrder++,
        question_type: q.question_type,
        question_text: q.question_text,
        image_url: q.image_url,
        options: q.options,
        correct_answer: q.correct_answer,
        answer_tolerance: q.answer_tolerance,
        marks: q.marks,
        negative_marks: q.negative_marks,
        difficulty: q.difficulty,
      });
    }

    let insertedQuestions = 0;
    if (questionRows.length > 0) {
      const { error: questionsError, data: insertedRows } = await supabase
        .from('questions')
        .insert(questionRows)
        .select('id');

      if (questionsError) {
        // The sets we just created now have zero questions under them --
        // clean them up rather than leaving empty "Set N" rows in the
        // list. Best-effort: if this cleanup itself fails, the failure
        // message below still tells the admin exactly what happened.
        if (insertedSetIds.length > 0) {
          await supabase.from('question_sets').delete().in('id', insertedSetIds);
          insertedSets = 0;
        }
        failures.push(
          `Questions failed to save as a batch: ${questionsError.message}. ` +
          (insertedSetIds.length > 0 ? 'The sets just created for this import were rolled back.' : '')
        );
      } else {
        insertedQuestions = insertedRows?.length ?? questionRows.length;
      }
    }

    setIsImporting(false);
    setResult({ insertedSets, insertedQuestions, failures });

    if (failures.length === 0) {
      onImported();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Import Questions</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{mock.title}</p>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {result ? (
        <div className="card p-6 space-y-3">
          <p className="text-sm text-neutral-700">
            Imported <strong>{result.insertedSets}</strong> set(s) and{' '}
            <strong>{result.insertedQuestions}</strong> question(s).
          </p>
          {result.failures.length > 0 && (
            <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
              <p className="text-sm font-medium text-error-700 mb-1">Some items failed:</p>
              <ul className="text-xs text-error-700 list-disc list-inside space-y-0.5">
                {result.failures.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          <button
            onClick={() => (result.failures.length === 0 ? onImported() : onClose())}
            className="btn-primary w-full"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="card p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-500">Not sure of the format?</span>
            {SECTION_ORDER.map((sec) => (
              <button key={sec} onClick={() => downloadTemplate(sec)} className="btn-secondary text-xs px-3 py-1.5">
                Download {sec} template
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Upload a .json file</label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              ...or paste JSON directly
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              placeholder='{ "section": "VARC", "sets": [ ... ] }'
              className="input font-mono text-xs"
            />
          </div>

          {errors.length > 0 && (
            <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
              <p className="text-sm font-medium text-error-700 mb-1">Fix these before importing:</p>
              <ul className="text-xs text-error-700 list-disc list-inside space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleImport}
              disabled={!jsonText.trim() || isImporting}
              className="btn-primary flex-1"
            >
              {isImporting ? 'Importing...' : 'Validate & Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function QuestionRow({
  question, index, onEdit, locked,
}: {
  question: Question;
  index: number;
  onEdit: () => void;
  locked: boolean;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (deleteConfirm) {
    return (
      <div className="p-4 bg-error-50 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-error-700">Delete this question?</p>
          <div className="flex gap-2">
            <button onClick={() => { setDeleteConfirm(false); setDeleteError(null); }} className="btn-secondary text-xs">Cancel</button>
            <button
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                const { error } = await supabase.from('questions').delete().eq('id', question.id);
                setDeleting(false);
                if (error) {
                  setDeleteError(error.message);
                  return;
                }
                window.location.reload();
              }}
              className="btn-danger text-xs"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        {deleteError && <p className="text-xs text-error-700">Failed to delete: {deleteError}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-neutral-400">Q{index + 1}</span>
          <span className={`badge ${question.question_type === 'MCQ' ? 'badge-primary' : 'badge-neutral'}`}>{question.question_type}</span>
          {question.difficulty && (
            <span className={`badge ${
              question.difficulty === 'easy' ? 'badge-success' :
              question.difficulty === 'medium' ? 'badge-warning' : 'badge-error'
            }`}>{question.difficulty}</span>
          )}
          <span className="text-xs text-neutral-400">+{question.marks}/-{question.negative_marks}</span>
        </div>
        <p className="text-sm text-neutral-700 line-clamp-2">{question.question_text}</p>
        <p className="text-xs text-neutral-400 mt-1">Correct: {question.correct_answer}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {locked ? (
          <span className="p-2 text-neutral-300" title="Unlock the mock to edit">
            <Lock className="w-3.5 h-3.5" />
          </span>
        ) : (
          <>
            <button onClick={onEdit} className="btn-ghost p-2" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setDeleteConfirm(true)} className="btn-ghost p-2 text-error-500" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const SUB_TOPICS: Record<Section, string[]> = {
  VARC: ['Reading Comprehension', 'Verbal Reasoning'],
  DILR: ['Data Interpretation', 'Logical Reasoning'],
  QA: ['Numbers', 'Arithmetic', 'Algebra', 'Geometry', 'Modern Math'],
};

function QuestionEditor({
  mock, question, questionSets, onClose, onSaved,
}: {
  mock: Mock;
  question: Question | null;
  questionSets: QuestionSet[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [section, setSection] = useState<Section>(question?.section || 'VARC');
  const [questionType, setQuestionType] = useState<QuestionType>(question?.question_type || 'MCQ');
  const [questionText, setQuestionText] = useState(question?.question_text || '');
  const [imageUrl, setImageUrl] = useState(question?.image_url || '');
  const [correctAnswer, setCorrectAnswer] = useState(question?.correct_answer || '');
  const [answerTolerance, setAnswerTolerance] = useState(question?.answer_tolerance || 0);
  const [marks, setMarks] = useState(question?.marks || 3);
  const [negativeMarks, setNegativeMarks] = useState(question?.negative_marks || 1);
  const [difficulty, setDifficulty] = useState<Difficulty | ''>(question?.difficulty || '');
  const [displayOrder, setDisplayOrder] = useState(question?.display_order || 0);
  const [setId, setSetId] = useState<string | ''>(question?.set_id || '');
  const [attemptPriority, setAttemptPriority] = useState<'A' | 'B' | 'C' | ''>(question?.attempt_priority || '');
  const [subTopic, setSubTopic] = useState(question?.sub_topic || '');
  const [topperTime, setTopperTime] = useState(question?.topper_time || '');
  const [topperAttemptPct, setTopperAttemptPct] = useState<number | ''>(question?.topper_attempt_pct ?? '');
  const [topperAccuracyPct, setTopperAccuracyPct] = useState<number | ''>(question?.topper_accuracy_pct ?? '');
  const [topperPValue, setTopperPValue] = useState<number | ''>(question?.topper_p_value ?? '');
  const [overallTime, setOverallTime] = useState(question?.overall_time || '');
  const [overallAttemptPct, setOverallAttemptPct] = useState<number | ''>(question?.overall_attempt_pct ?? '');
  const [overallAccuracyPct, setOverallAccuracyPct] = useState<number | ''>(question?.overall_accuracy_pct ?? '');
  const [overallPValue, setOverallPValue] = useState<number | ''>(question?.overall_p_value ?? '');
  const [solutionImageUrl, setSolutionImageUrl] = useState(question?.solution_image_url || '');
  const [solutionVideoUrl, setSolutionVideoUrl] = useState(question?.solution_video_url || '');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    question?.options || [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }]
  );
  const [passageText, setPassageText] = useState('');
  const [passageImageUrl, setPassageImageUrl] = useState('');
  const [showNewSet, setShowNewSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionSets = questionSets.filter((s) => s.section === section);

  const updateOption = (idx: number, text: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let finalSetId = setId || null;

      // Create new question set if needed
      if (showNewSet && passageText) {
        const { data: newSet, error: setErr } = await supabase
          .from('question_sets')
          .insert({
            mock_id: mock.id,
            section,
            passage_text: passageText,
            passage_image_url: passageImageUrl || null,
            display_order: sectionSets.length,
          })
          .select()
          .single();
        if (setErr) throw setErr;
        finalSetId = newSet.id;
      }

      const data = {
        mock_id: mock.id,
        set_id: finalSetId,
        section,
        display_order: displayOrder,
        question_type: questionType,
        question_text: questionText,
        image_url: imageUrl || null,
        options: questionType === 'MCQ' ? options : null,
        correct_answer: correctAnswer,
        answer_tolerance: answerTolerance,
        marks,
        negative_marks: negativeMarks,
        difficulty: difficulty || null,
        attempt_priority: attemptPriority,
        sub_topic: subTopic,
        topper_time: topperTime,
        topper_attempt_pct: topperAttemptPct === '' ? null : Number(topperAttemptPct),
        topper_accuracy_pct: topperAccuracyPct === '' ? null : Number(topperAccuracyPct),
        topper_p_value: topperPValue === '' ? null : Number(topperPValue),
        overall_time: overallTime || null,
        overall_attempt_pct: overallAttemptPct === '' ? null : Number(overallAttemptPct),
        overall_accuracy_pct: overallAccuracyPct === '' ? null : Number(overallAccuracyPct),
        overall_p_value: overallPValue === '' ? null : Number(overallPValue),
        solution_image_url: solutionImageUrl || null,
        solution_video_url: solutionVideoUrl || null,
      };

      if (question) {
        const { error } = await supabase.from('questions').update(data).eq('id', question.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questions').insert(data);
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">{question ? 'Edit Question' : 'New Question'}</h2>
        <button onClick={onClose} className="btn-ghost p-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="card p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Section</label>
            <select value={section} onChange={(e) => { setSection(e.target.value as Section); setSetId(''); setShowNewSet(false); setSubTopic(''); }} className="input">
              {SECTION_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Question Type</label>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value as QuestionType)} className="input">
              <option value="MCQ">MCQ (Multiple Choice)</option>
              <option value="TITA">TITA (Type in the Answer)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Question Set (optional)</label>
          <div className="flex gap-2">
            <select value={setId} onChange={(e) => { setSetId(e.target.value); setShowNewSet(false); }} className="input flex-1">
              <option value="">No set (standalone)</option>
              {sectionSets.map((s) => (
                <option key={s.id} value={s.id}>Set {s.display_order + 1}: {s.passage_text?.slice(0, 50) || 'No passage'}...</option>
              ))}
            </select>
            <button onClick={() => setShowNewSet(!showNewSet)} className="btn-secondary">
              {showNewSet ? 'Cancel' : 'New Set'}
            </button>
          </div>
          {showNewSet && (
            <div className="mt-3 p-4 bg-neutral-50 rounded-lg space-y-3 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Passage Text</label>
                <textarea value={passageText} onChange={(e) => setPassageText(e.target.value)} className="input min-h-[80px]" placeholder="Paste the reading comprehension passage or DILR data set here..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Passage Image URL (optional)</label>
                <input type="text" value={passageImageUrl} onChange={(e) => setPassageImageUrl(e.target.value)} className="input" placeholder="https://..." />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Question Text</label>
          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="input min-h-[100px]" placeholder="Enter the question..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Image URL (optional)</label>
          <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" placeholder="https://..." />
        </div>

        {questionType === 'MCQ' && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Options</label>
            <p className="text-xs text-neutral-400 mb-2">Enter the correct answer's option ID (a, b, c, or d) in the "Correct Answer" field below.</p>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {opt.id.toUpperCase()}
                  </div>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className="input"
                    placeholder={`Option ${opt.id.toUpperCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Correct Answer</label>
            <input
              type="text"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              className="input"
              placeholder={questionType === 'MCQ' ? 'e.g., a' : 'e.g., 42.5'}
            />
          </div>
          {questionType === 'TITA' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Answer Tolerance</label>
              <input
                type="number"
                value={answerTolerance}
                onChange={(e) => setAnswerTolerance(Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Marks</label>
            <input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="input" step="0.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Negative Marks</label>
            <input type="number" value={negativeMarks} onChange={(e) => setNegativeMarks(Number(e.target.value))} className="input" step="0.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | '')} className="input">
              <option value="">None</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Display Order</label>
          <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} className="input w-32" />
        </div>

        <div className="pt-2 border-t border-neutral-200">
          <p className="text-sm font-semibold text-neutral-800 mb-1">Post-Exam Analytics</p>
          <p className="text-xs text-neutral-400 mb-3">
            Entered by you after sourcing topper data -- shown only on students' results page, never during the exam. All fields required to save.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Attempt Priority</label>
              <select value={attemptPriority} onChange={(e) => setAttemptPriority(e.target.value as 'A' | 'B' | 'C' | '')} className="input">
                <option value="">Select...</option>
                <option value="A">A -- Attempt Immediately</option>
                <option value="B">B -- Attempt Later</option>
                <option value="C">C -- Do Not Attempt</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Sub-Topic</label>
              <select value={subTopic} onChange={(e) => setSubTopic(e.target.value)} className="input">
                <option value="">Select...</option>
                {SUB_TOPICS[section].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Topper's Time</label>
              <input
                type="text"
                value={topperTime}
                onChange={(e) => setTopperTime(e.target.value)}
                className="input"
                placeholder="e.g. 02:19"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Topper's Attempt (%)</label>
              <input
                type="number"
                value={topperAttemptPct}
                onChange={(e) => setTopperAttemptPct(e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="e.g. 94.8"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Topper's Accuracy (%)</label>
              <input
                type="number"
                value={topperAccuracyPct}
                onChange={(e) => setTopperAccuracyPct(e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="e.g. 60.34"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Topper's p-value</label>
              <input
                type="number"
                value={topperPValue}
                onChange={(e) => setTopperPValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="e.g. 57.20"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-200">
          <p className="text-sm font-semibold text-neutral-800 mb-1">Overall Test Takers &amp; Solutions</p>
          <p className="text-xs text-neutral-400 mb-3">
            Optional -- add these whenever you have them. Shown on the Solutions review page only, and only once you release solutions for this mock.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Overall Time</label>
              <input
                type="text"
                value={overallTime}
                onChange={(e) => setOverallTime(e.target.value)}
                className="input"
                placeholder="e.g. 05:28"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Overall Attempt (%)</label>
              <input
                type="number"
                value={overallAttemptPct}
                onChange={(e) => setOverallAttemptPct(e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="e.g. 84.64"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Overall Accuracy (%)</label>
              <input
                type="number"
                value={overallAccuracyPct}
                onChange={(e) => setOverallAccuracyPct(e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="e.g. 69.40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Overall p-value</label>
              <input
                type="number"
                value={overallPValue}
                onChange={(e) => setOverallPValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="e.g. 58.74"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Solution Image URL</label>
              <input
                type="text"
                value={solutionImageUrl}
                onChange={(e) => setSolutionImageUrl(e.target.value)}
                className="input"
                placeholder="https://... (keep it compressed, e.g. under ~150 KB)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Solution Video URL (YouTube)</label>
              <input
                type="text"
                value={solutionVideoUrl}
                onChange={(e) => setSolutionVideoUrl(e.target.value)}
                className="input"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !questionText ||
              !correctAnswer ||
              !attemptPriority ||
              !subTopic ||
              !topperTime ||
              topperAttemptPct === '' ||
              topperAccuracyPct === '' ||
              topperPValue === ''
            }
            className="btn-primary flex-1"
          >
            {saving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// GRADING TAB (scoped to one mock)
// ═══════════════════════════════════════════
function GradingTab({ mock }: { mock: Mock }) {
  const [sheets, setSheets] = useState<GradingSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [activeScope, setActiveScope] = useState<GradingScope>('overall');
  const [rowError, setRowError] = useState<string | null>(null);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('grading_sheets')
      .select('*')
      .eq('mock_id', mock.id)
      .order('scope', { ascending: true })
      .order('raw_marks', { ascending: false });
    setSheets((data as GradingSheet[]) || []);
    setLoading(false);
  }, [mock.id]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  const scopeSheets = sheets.filter((s) => s.scope === activeScope);
  const scopes: GradingScope[] = ['overall', 'VARC', 'DILR', 'QA'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">Grading Sheets</h2>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-4 w-fit">
        {scopes.map((scope) => (
          <button
            key={scope}
            onClick={() => setActiveScope(scope)}
            className={`py-1.5 px-3 rounded-md text-sm font-medium transition-all capitalize ${
              activeScope === scope ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {scope}
          </button>
        ))}
      </div>

      {rowError && (
        <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error-700">Failed to delete: {rowError}</p>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-neutral-400">Loading...</div>
      ) : scopeSheets.length === 0 ? (
        <div className="card p-12 text-center">
          <Award className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 mb-2">No grading entries for {activeScope}.</p>
          <p className="text-xs text-neutral-400">Add entries mapping raw marks to percentiles. The mock cannot be published without at least one overall entry.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Raw Marks</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Percentile</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Grade</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {scopeSheets.map((sheet) => (
                <tr key={sheet.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{sheet.raw_marks}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700">{sheet.percentile !== null ? `${sheet.percentile}%` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700">{sheet.grade || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => {
                        setRowError(null);
                        const { error } = await supabase.from('grading_sheets').delete().eq('id', sheet.id);
                        if (error) { setRowError(error.message); return; }
                        fetchSheets();
                      }}
                      className="btn-ghost p-1.5 text-error-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <GradingEntryModal
          mockId={mock.id}
          scope={activeScope}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchSheets(); }}
        />
      )}
    </div>
  );
}

function GradingEntryModal({
  mockId, scope, onClose, onSaved,
}: {
  mockId: string;
  scope: GradingScope;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rawMarks, setRawMarks] = useState(0);
  const [percentile, setPercentile] = useState<number | ''>('');
  const [grade, setGrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('grading_sheets').insert({
        mock_id: mockId,
        scope,
        raw_marks: rawMarks,
        percentile: percentile === '' ? null : percentile,
        grade: grade || null,
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
      <div className="card p-6 max-w-md w-full animate-scale-in">
        <h3 className="font-semibold text-neutral-900 mb-4">Add Grading Entry ({scope})</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Raw Marks</label>
            <input type="number" value={rawMarks} onChange={(e) => setRawMarks(Number(e.target.value))} className="input" step="0.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Percentile (optional)</label>
            <input type="number" value={percentile} onChange={(e) => setPercentile(e.target.value === '' ? '' : Number(e.target.value))} className="input" step="0.1" placeholder="e.g., 95.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Grade (optional)</label>
            <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="input" placeholder="e.g., A+" />
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ACCESS TAB (scoped to one mock)
// ═══════════════════════════════════════════
function AccessTab({ mock }: { mock: Mock }) {
  const [accessList, setAccessList] = useState<{ id: string; student: Profile }[]>([]);
  const [allStudents, setAllStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'browse' | 'paste'>('browse');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailInput, setEmailInput] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<{ granted: number; alreadyHad: number; notFound: string[] } | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    setLoading(true);
    const { data: accessData } = await supabase
      .from('mock_access')
      .select('id, student_id')
      .eq('mock_id', mock.id);

    if (accessData && accessData.length > 0) {
      const studentIds = (accessData as MockAccess[]).map((a) => a.student_id);
      const { data: students } = await supabase
        .from('profiles')
        .select('*')
        .in('id', studentIds)
        .eq('role', 'student');
      const studentMap = new Map<string, Profile>();
      (students as Profile[] || []).forEach((s) => studentMap.set(s.id, s));
      const list = (accessData as MockAccess[]).map((a) => ({
        id: a.id,
        student: studentMap.get(a.student_id)!,
      })).filter((item) => item.student);
      setAccessList(list);
    } else {
      setAccessList([]);
    }

    const { data: allStudentsData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    setAllStudents((allStudentsData as Profile[]) || []);
    setLoading(false);
  }, [mock.id]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const closeModal = () => {
    setShowAdd(false);
    setSelectedIds(new Set());
    setEmailInput('');
    setGrantResult(null);
    setSearch('');
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGrantSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsGranting(true);
    const rows = Array.from(selectedIds).map((studentId) => ({ mock_id: mock.id, student_id: studentId }));
    const { error, data } = await supabase
      .from('mock_access')
      .upsert(rows, { onConflict: 'mock_id,student_id', ignoreDuplicates: true })
      .select('id');
    setIsGranting(false);
    if (error) {
      setGrantResult({ granted: 0, alreadyHad: 0, notFound: [`Failed to grant access: ${error.message}`] });
      return;
    }
    const granted = data?.length ?? 0;
    setGrantResult({ granted, alreadyHad: rows.length - granted, notFound: [] });
    setSelectedIds(new Set());
    fetchAccess();
  };

  const handleGrantByEmail = async () => {
    const emails: string[] = Array.from(
      new Set(
        emailInput
          .split(/[\s,;\n]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e): e is string => e.length > 0)
      )
    );
    if (emails.length === 0) return;

    setIsGranting(true);
    const { data: matched, error: lookupError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'student')
      .in('email', emails);

    if (lookupError) {
      setIsGranting(false);
      setGrantResult({ granted: 0, alreadyHad: 0, notFound: [`Lookup failed: ${lookupError.message}`] });
      return;
    }

    const matchedRows = (matched as { id: string; email: string }[]) ?? [];
    const matchedEmails = new Set(matchedRows.map((m) => m.email.toLowerCase()));
    const notFound = emails.filter((e) => !matchedEmails.has(e));

    if (matchedRows.length === 0) {
      setIsGranting(false);
      setGrantResult({ granted: 0, alreadyHad: 0, notFound });
      return;
    }

    const rows = matchedRows.map((m) => ({ mock_id: mock.id, student_id: m.id }));
    const { error: grantError, data } = await supabase
      .from('mock_access')
      .upsert(rows, { onConflict: 'mock_id,student_id', ignoreDuplicates: true })
      .select('id');

    setIsGranting(false);
    if (grantError) {
      setGrantResult({ granted: 0, alreadyHad: 0, notFound: [`Failed to grant access: ${grantError.message}`, ...notFound] });
      return;
    }
    const granted = data?.length ?? 0;
    setGrantResult({ granted, alreadyHad: rows.length - granted, notFound });
    setEmailInput('');
    fetchAccess();
  };

  const assignedIds = new Set(accessList.map((a) => a.student.id));
  const availableStudents = allStudents.filter((s) => !assignedIds.has(s.id));
  const filteredAvailable = search
    ? availableStudents.filter((s) => s.email.toLowerCase().includes(search.toLowerCase()) || (s.name && s.name.toLowerCase().includes(search.toLowerCase())))
    : availableStudents;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">Student Access</h2>
        <button onClick={() => setShowAdd(true)} disabled={availableStudents.length === 0} className="btn-primary">
          <Plus className="w-4 h-4" />
          Grant Access
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-neutral-400">Loading...</div>
      ) : accessList.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No students have access to this mock yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {revokeError && (
            <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error-700">Failed to revoke access: {revokeError}</p>
            </div>
          )}
          {accessList.map((item) => (
            <div key={item.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                  {item.student.name?.[0]?.toUpperCase() || item.student.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{item.student.name || 'Unnamed'}</p>
                  <p className="text-xs text-neutral-500">{item.student.email}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setRevokeError(null);
                  const { error } = await supabase.from('mock_access').delete().eq('id', item.id);
                  if (error) { setRevokeError(error.message); return; }
                  fetchAccess();
                }}
                className="btn-ghost p-2 text-error-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">Grant Access</h3>
              <button onClick={closeModal} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-4 w-fit">
              <button
                onClick={() => { setMode('browse'); setGrantResult(null); }}
                className={`py-1.5 px-4 rounded-md text-sm font-medium transition-all ${mode === 'browse' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}
              >
                Select students
              </button>
              <button
                onClick={() => { setMode('paste'); setGrantResult(null); }}
                className={`py-1.5 px-4 rounded-md text-sm font-medium transition-all ${mode === 'paste' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}
              >
                Paste email list
              </button>
            </div>

            {grantResult && (
              <div className="p-3 bg-success-50 border border-success-200 rounded-lg mb-4 text-sm">
                <p className="text-success-700">
                  Granted access to <strong>{grantResult.granted}</strong> student(s).
                  {grantResult.alreadyHad > 0 && ` ${grantResult.alreadyHad} already had access.`}
                </p>
                {grantResult.notFound.length > 0 && (
                  <p className="text-warning-600 mt-1">
                    Not found: {grantResult.notFound.join(', ')}
                  </p>
                )}
              </div>
            )}

            {mode === 'browse' ? (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="input mb-3"
                />
                <div className="space-y-1.5 max-h-64 overflow-y-auto mb-4">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-4">No students found.</p>
                  ) : (
                    filteredAvailable.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleSelected(student.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-900">{student.name || 'Unnamed'}</p>
                          <p className="text-xs text-neutral-500">{student.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <button
                  onClick={handleGrantSelected}
                  disabled={selectedIds.size === 0 || isGranting}
                  className="btn-primary w-full"
                >
                  {isGranting ? 'Granting...' : `Grant to ${selectedIds.size} selected`}
                </button>
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Emails (one per line, or comma/space separated)
                </label>
                <textarea
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  rows={8}
                  placeholder={'student1@example.com\nstudent2@example.com'}
                  className="input mb-4"
                />
                <button
                  onClick={handleGrantByEmail}
                  disabled={!emailInput.trim() || isGranting}
                  className="btn-primary w-full"
                >
                  {isGranting ? 'Granting...' : 'Grant Access'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════
function StudentsTab() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });
      setStudents((data as Profile[]) || []);
      setLoading(false);
    };
    fetchStudents();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">All Students</h2>
      {loading ? (
        <div className="card p-8 text-center text-neutral-400">Loading...</div>
      ) : students.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No students have registered yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{student.name || 'Unnamed'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{student.email}</td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{new Date(student.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
function DeleteConfirmModal({
  title, message, onCancel, onConfirm, error, confirming, confirmLabel, tone = 'danger',
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Shown when the confirmed action itself failed (e.g. a delete's RPC error) -- the modal stays open so the admin isn't left thinking it worked. */
  error?: string | null;
  confirming?: boolean;
  confirmLabel?: string;
  /** 'danger' (red, for destructive actions) or 'warning' (amber, for reversible-but-risky actions like unlocking). */
  tone?: 'danger' | 'warning';
}) {
  const iconBg = tone === 'warning' ? 'bg-warning-100 text-warning-600' : 'bg-error-100 text-error-600';
  const confirmClass = tone === 'warning' ? 'btn' : 'btn-danger';
  const confirmStyle =
    tone === 'warning'
      ? 'bg-warning-500 text-white hover:bg-warning-600 focus:ring-warning-400 shadow-sm flex-1'
      : 'flex-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
      <div className="card p-6 max-w-md w-full animate-scale-in">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900">{title}</h3>
            <p className="text-sm text-neutral-500 mt-1">{message}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={confirming} className={`${confirmClass} ${confirmStyle}`}>
            {confirming ? 'Working...' : confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}