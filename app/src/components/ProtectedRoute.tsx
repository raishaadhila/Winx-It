import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { GlassCard } from './GlassCard';
import { SparkleField } from './SparkleField';

type Props = {
  children: React.ReactNode;
  requireOnboarding?: boolean;
};

export function ProtectedRoute({ children, requireOnboarding = true }: Props) {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (authLoading || (session && profileLoading && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center ambient-gradient">
        <SparkleField count={20} />
        <GlassCard level={3} className="p-8 text-center">
          <span className="inline-block text-4xl animate-spin text-primary">✦</span>
          <p className="mt-3 font-label text-label-caps text-on-surface-variant">Loading…</p>
        </GlassCard>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (requireOnboarding && !profile) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
