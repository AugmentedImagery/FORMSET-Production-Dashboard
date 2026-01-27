'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { UserProfile, UserRole } from '@/types/database';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  initialized: boolean;
  role: UserRole;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    initialized: false,
    role: 'viewer',
  });

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Failed to fetch user profile:', error.message);
          return null;
        }
        return data as UserProfile;
      } catch (err) {
        console.error('Profile fetch exception:', err);
        return null;
      }
    };

    const handleAuthChange = async (_event: AuthChangeEvent, session: Session | null) => {

      if (!mounted) return;

      if (session?.user) {
        // Set user immediately, then fetch profile
        setState(prev => ({
          ...prev,
          user: session.user,
          initialized: true,
        }));

        // Fetch profile in background
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;

        setState(prev => ({
          ...prev,
          profile,
          role: profile?.role || 'viewer',
        }));
      } else {
        setState({
          user: null,
          profile: null,
          initialized: true,
          role: 'viewer',
        });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        handleAuthChange(event, session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

  return {
    user: state.user,
    profile: state.profile,
    initialized: state.initialized,
    role: state.role,
    signOut,
    isAdmin: state.role === 'admin',
    isManager: state.role === 'manager',
    canEdit: state.role === 'admin' || state.role === 'manager',
  };
}
