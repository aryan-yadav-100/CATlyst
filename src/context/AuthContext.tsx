import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Tracks whose profile is currently loaded, read inside the
  // onAuthStateChange closure below. A ref (not the `profile` state
  // itself) because that listener is registered once on mount --
  // reading `profile` directly there would always see its value from
  // that first render, never later updates.
  const profileUserIdRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }
    setProfile(data as Profile | null);
    profileUserIdRef.current = (data as Profile | null)?.id ?? null;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (!session?.user) {
        profileUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED fires constantly -- including every time the
      // tab regains focus/visibility, since Supabase's client
      // proactively re-checks the session then. That never changes
      // whose profile it is, so skip the re-fetch when we already
      // have the right one loaded. A real sign-in (or a token refresh
      // landing before any profile has loaded yet, e.g. right after
      // getSession() above) still fetches normally.
      if (event === 'TOKEN_REFRESHED' && profileUserIdRef.current === session.user.id) {
        setLoading(false);
        return;
      }

      (async () => {
        await fetchProfile(session.user.id);
        setLoading(false);
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    profileUserIdRef.current = null;
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}