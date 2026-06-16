import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase not configured. See .env.example.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: friendlyAuthError(error.message, 'signin') } : {};
  };

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase not configured. See .env.example.' };
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { error: friendlyAuthError(error.message, 'signup') } : {};
  };

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured) return { error: 'Supabase not configured. See .env.example.' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
    return error ? { error: friendlyAuthError(error.message, 'oauth') } : {};
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase not configured. See .env.example.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });
    return error ? { error: friendlyAuthError(error.message, 'reset') } : {};
  };

  const signOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setSession(null);
  };

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
    isConfigured: isSupabaseConfigured,
    signIn,
    signUp,
    signInWithOAuth,
    resetPassword,
    signOut,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Translate Supabase's sometimes-cryptic error messages into user-friendly copy.
 */
function friendlyAuthError(message: string, _context: 'signin' | 'signup' | 'oauth' | 'reset'): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Wrong email or password. Try again, or reset your password below.';
  }
  if (m.includes('email not confirmed')) {
    return 'Check your inbox to confirm your email first, then sign in.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'An account with that email already exists. Try signing in instead.';
  }
  if (m.includes('password should be at least')) {
    return 'Password must be at least 6 characters.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Network hiccup. Check your connection and retry.';
  }
  if (m.includes('provider') && m.includes('not enabled')) {
    return 'That sign-in method is not enabled. Enable it in Supabase Auth settings.';
  }
  if (m.includes('redirect')) {
    return 'OAuth redirect URL not allowed. Add this URL to Supabase Auth → URL Configuration.';
  }

  // Fallback: surface the raw message but trimmed
  return message.length > 140 ? message.slice(0, 140) + '…' : message;
}
