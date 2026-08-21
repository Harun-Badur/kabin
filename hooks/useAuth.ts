import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { toTurkishAuthMessage } from '../lib/authError';
import { ensureUserProfile } from '../services/likeService';
import type { AuthUser, SignInParams, SignUpParams, SignUpResult } from '../types/auth';

interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
  signIn: (params: SignInParams) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const mapAuthUser = (user: User | null | undefined): AuthUser | null => {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    email: user.email ?? null,
  };
};

export const useAuth = (): UseAuthResult => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setUser(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadSession = async (): Promise<void> => {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          throw error;
        }
        if (isMounted) {
          setUser(mapAuthUser(data.session?.user));
        }
      } catch (error) {
        console.error('Oturum okunamadı', { error });
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    const { data: listener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) {
          return;
        }
        setUser(mapAuthUser(session?.user));
        setLoading(false);
      },
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ email, password }: SignInParams): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase yapılandırması eksik.');
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(toTurkishAuthMessage(error));
    }

    const mapped = mapAuthUser(data.user);
    if (mapped) {
      try {
        await ensureUserProfile(mapped);
      } catch (profileError) {
        console.error('Profil senkronu başarısız', { profileError });
      }
    }
  }, []);

  const signUp = useCallback(async ({ email, password }: SignUpParams): Promise<SignUpResult> => {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase yapılandırması eksik.');
    }

    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(toTurkishAuthMessage(error));
    }

    const mapped = mapAuthUser(data.user);
    if (mapped && data.session) {
      try {
        await ensureUserProfile(mapped);
      } catch (profileError) {
        console.error('Profil senkronu başarısız', { profileError });
      }
      return { needsEmailConfirmation: false };
    }

    return { needsEmailConfirmation: true };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) {
      setUser(null);
      return;
    }
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error(toTurkishAuthMessage(error));
    }
  }, []);

  return { user, loading, signIn, signUp, signOut };
};
