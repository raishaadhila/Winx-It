import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from '../components/AmbientBackground';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { SparkleField } from '../components/SparkleField';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function WelcomePage() {
  const nav = useNavigate();
  const { signInWithOAuth, isConfigured } = useAuth();
  const toast = useToast();
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'github'>(null);

  const oauth = async (p: 'google' | 'github') => {
    setOauthLoading(p);
    const { error } = await signInWithOAuth(p);
    setOauthLoading(null);
    if (error) toast.error(error);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
      <AmbientBackground />
      <SparkleField count={50} />

      <div className="relative w-full max-w-lg">
        <GlassCard level={3} className="p-8 sm:p-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-primary text-3xl animate-twinkle">✦</span>
            <h1 className="font-display text-headline-lg-mobile md:text-headline-xl font-extrabold text-primary">
              Winx It!
            </h1>
            <span
              className="text-primary text-3xl animate-twinkle"
              style={{ animationDelay: '1s' }}
            >
              ✦
            </span>
          </div>

          <p className="font-body text-body-lg text-on-surface-variant mb-2">
            Turn your goals into a magical quest.
          </p>
          <p className="font-label text-label-caps text-on-surface-variant/70 mb-8">
            AI-crafted daily challenges • streak XP • personalized pillars
          </p>

          {!isConfigured && (
            <div className="mb-6 p-3 rounded-lg bg-[#ffd7f0]/30 border border-primary/30 text-left">
              <p className="font-label text-label-caps text-on-surface leading-relaxed">
                ⚠ Supabase not configured. Copy <code className="px-1 bg-white/50 rounded">.env.example</code> to <code className="px-1 bg-white/50 rounded">.env</code> and add your keys.
              </p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <Button
              onClick={() => nav('/login')}
              className="w-full"
              size="lg"
            >
              ✦ Sign in
            </Button>
            <Button
              onClick={() => nav('/signup')}
              variant="outline"
              className="w-full"
              size="lg"
            >
              ✦ Create account
            </Button>
          </div>

          <p className="my-5 text-center font-label text-label-caps text-on-surface-variant">
            or continue with
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => oauth('google')}
              loading={oauthLoading === 'google'}
              disabled={!!oauthLoading}
            >
              <span>G</span> Google
            </Button>
            <Button
              variant="outline"
              onClick={() => oauth('github')}
              loading={oauthLoading === 'github'}
              disabled={!!oauthLoading}
            >
              <span>⌥</span> GitHub
            </Button>
          </div>

          <p className="text-center mt-8 font-body text-body-sm text-on-surface-variant/70">
            By continuing you agree to the Winx It! code of conduct:<br />
            be kind, ship things, and never skip leg day.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
