/**
 * Auth route guard. Three states:
 *
 *   1. No Supabase session          -> redirect to /welcome
 *   2. Session, profile incomplete  -> redirect to /onboarding
 *   3. Session, profile complete    -> render children
 *
 * "Profile complete" = api.me.get() returned a profile with a non-empty
 * name AND a fairy set. We also wait for the profile fetch to settle so
 * a brand-new user (whose row was just created by the Supabase trigger)
 * doesn't get bounced back to /onboarding.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const loc = useLocation();
  const [profileChecked, setProfileChecked] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setProfileChecked(true);
      setProfileReady(false);
      return () => { cancelled = true; };
    }
    api.me.get()
      .then((p) => {
        if (cancelled) return;
        // Treat empty name OR missing fairy as "needs onboarding"
        const complete = !!(p?.name && p?.fairy);
        setProfileReady(complete);
        setProfileChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        // If we can't read the profile, let the page handle it (e.g. a
        // /plan/new request might still work in guest-ish mode).
        setProfileReady(true);
        setProfileChecked(true);
      });
    return () => { cancelled = true; };
  }, [session]);

  if (authLoading || !profileChecked) {
    // Render nothing while we figure things out. The real pages all have
    // their own loading skeletons; the guard itself stays invisible.
    return null;
  }

  if (!session) {
    return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  }

  if (!profileReady) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
