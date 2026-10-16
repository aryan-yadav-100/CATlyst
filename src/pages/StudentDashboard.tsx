import { useEffect, useState } from 'react';
import {
  GraduationCap,
  LogOut,
  Clock,
  FileText,
  Trophy,
  Play,
  RefreshCw,
  AlertCircle,
  BookOpen,
  Shield,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getDashboard, type DashboardMockRow } from '@/lib/api';
import type { Route } from '@/App';

export function StudentDashboard({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { profile, signOut } = useAuth();
  const [mocks, setMocks] = useState<DashboardMockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboard();
      setMocks(result.mocks);
    } catch (err) {
      // Previously a failed query looked identical to "no tests
      // assigned yet" -- surfacing it explicitly avoids that.
      setError(err instanceof Error ? err.message : 'Failed to load your dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getButtonState = (row: DashboardMockRow): 'start' | 'resume' | 'results' => {
    if (!row.attempt || row.attempt.status === 'not_started') return 'start';
    if (row.attempt.status === 'in_progress') return 'resume';
    return 'results';
  };

  const totalDuration = (row: DashboardMockRow) => {
    const { section_duration_varc, section_duration_dilr, section_duration_qa } = row.mock;
    return Math.round((section_duration_varc + section_duration_dilr + section_duration_qa) / 60);
  };

  const isWithinWindow = (row: DashboardMockRow) => {
    const now = Date.now();
    if (row.mock.available_from && now < new Date(row.mock.available_from).getTime()) return false;
    if (row.mock.available_until && now > new Date(row.mock.available_until).getTime()) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">CAT Mock Test</h1>
              <p className="text-xs text-neutral-500">Student Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.role === 'admin' && (
              <button onClick={() => onNavigate({ name: 'admin' })} className="btn-secondary text-sm">
                <Settings className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-neutral-700">{profile?.name || profile?.email}</p>
              <p className="text-xs text-neutral-400">{profile?.role === 'admin' ? 'Admin' : 'Student'}</p>
            </div>
            <button onClick={signOut} className="btn-ghost p-2" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-900">
            Welcome back, {profile?.name?.split(' ')[0] || 'Student'}
          </h2>
          <p className="text-neutral-500 mt-1">Your assigned mock tests are ready below.</p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 p-4 bg-error-50 border border-error-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-error-700">{error}</p>
              <button onClick={() => void fetchDashboard()} className="text-sm text-error-700 underline mt-1">
                Try again
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-5 bg-neutral-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-neutral-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-neutral-200 rounded w-2/3 mb-6"></div>
                <div className="h-10 bg-neutral-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : mocks.length === 0 && !error ? (
          <div className="card p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
              <BookOpen className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-700 mb-2">No tests assigned yet</h3>
            <p className="text-sm text-neutral-500">Your instructor will assign mock tests to you. Check back later.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mocks.map((row) => {
              const btnState = getButtonState(row);
              const available = isWithinWindow(row);

              return (
                <div key={row.mock.id} className="card p-6 hover:shadow-md transition-shadow duration-200 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-neutral-900 text-lg leading-tight">{row.mock.title}</h3>
                    {btnState === 'results' && <span className="badge-success">Completed</span>}
                    {btnState === 'resume' && <span className="badge-warning">In Progress</span>}
                    {btnState === 'start' && <span className="badge-primary">New</span>}
                  </div>

                  {row.mock.description && (
                    <p className="text-sm text-neutral-500 mb-4 line-clamp-2">{row.mock.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-neutral-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{totalDuration(row)} min total</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>3 sections</span>
                    </div>
                  </div>

                  {!available && btnState !== 'results' && (
                    <p className="text-xs text-warning-600 mb-3">
                      {row.mock.available_from && Date.now() < new Date(row.mock.available_from).getTime()
                        ? `Opens ${new Date(row.mock.available_from).toLocaleString()}`
                        : 'This test window has closed.'}
                    </p>
                  )}

                  <div className="mt-auto">
                    {btnState === 'start' && (
                      <button
                        onClick={() => onNavigate({ name: 'test', mockId: row.mock.id })}
                        disabled={!available}
                        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" />
                        Start Test
                      </button>
                    )}
                    {btnState === 'resume' && (
                      <button
                        onClick={() => onNavigate({ name: 'test', mockId: row.mock.id })}
                        className="btn-primary w-full"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Resume Test
                      </button>
                    )}
                    {btnState === 'results' && row.attempt && (
                      <button
                        onClick={() => onNavigate({ name: 'results', attemptId: row.attempt!.id })}
                        className="btn-secondary w-full"
                      >
                        <Trophy className="w-4 h-4" />
                        View Result
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 card p-6 bg-gradient-to-br from-primary-50 to-secondary-50/50 border-primary-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-800 mb-1">Test Guidelines</h3>
              <ul className="text-sm text-neutral-600 space-y-1">
                <li>Each test has 3 timed sections: VARC, DILR, and QA</li>
                <li>Each section submits automatically when its timer ends -- there is no manual submit</li>
                <li>Switching tabs or exiting fullscreen will be logged as violations</li>
                <li>You can attempt each mock test only once</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}