import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from '../components/AmbientBackground';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { Input } from '../components/Input';
import { SparkleField } from '../components/SparkleField';
import { useAuth } from '../contexts/AuthContext';
import { isValidEmail } from '../lib/validation';

type Mode = 'signin' | 'signup';

export function LoginPage() {
  const nav = useNavigate();
  const { signIn, signUp, signInWithOAuth, resetPassword, isConfigured, session } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [resetMode, setResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'github'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session) nav('/dashboard', { replace: true });
  }, [session, nav]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setResetMode(false);
  };

  const canSubmit =
    isValidEmail(email) && (resetMode || pwd.length >= 6);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);

    if (resetMode) {
      const { error: err } = await resetPassword(email);
      setLoading(false);
      if (err) {
        setError(err);
        return;
      }
      setInfo(`Reset link sent to ${email} ✦ Check your inbox.`);
      return;
    }

    const fn = mode === 'signin' ? signIn : signUp;
    const { error: err } = await fn(email, pwd);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === 'signup') {
      setPwd('');
      setInfo(`Account created ✦ Check ${email} to confirm, then sign in.`);
      setMode('signin');
      return;
    }
    nav('/dashboard', { replace: true });
  };

  const oauth = async (p: 'google' | 'github') => {
    setError(null);
    setInfo(null);
    setOauthLoading(p);
    const { error: err } = await signInWithOAuth(p);
    setOauthLoading(null);
    if (err) setError(err);
  };

  const heading = resetMode
    ? 'Reset your password'
    : mode === 'signin'
      ? 'Welcome back, fairy.'
      : 'Begin your transformation.';

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
      <AmbientBackground />
      <SparkleField count={40} />

      <div className="relative w-full max-w-md">
        <GlassCard level={3} className="p-8 sm:p-10 relative">
          <div className="text-center mb-7 relative">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-primary text-2xl animate-twinkle">✦</span>
              <h1 className="font-display text-headline-lg-mobile md:text-headline-xl font-extrabold text-primary">
                Winx It!
              </h1>
              <span
                className="text-primary text-2xl animate-twinkle"
                style={{ animationDelay: '1s' }}
              >
                ✦
              </span>
            </div>
            <p className="font-body text-body-md text-on-surface-variant min-h-[24px]">
              {heading}
            </p>
          </div>

          {!isConfigured && (
            <div className="mb-4 p-3 rounded-lg bg-[#ffd7f0]/30 border border-primary/30">
              <p className="font-label text-label-caps text-on-surface leading-relaxed">
                ⚠ Supabase not configured. Copy <code className="px-1 bg-white/50 rounded">.env.example</code> to <code className="px-1 bg-white/50 rounded">.env</code> and add your keys.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-lg bg-error-container/50 border border-error/30 flex items-start gap-2"
            >
              <span className="text-error text-lg leading-none mt-0.5">⚠</span>
              <p className="font-body text-body-md text-on-error-container flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-on-error-container/60 hover:text-on-error-container"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {info && (
            <div className="mb-4 p-3 rounded-lg bg-[#b1dd00]/25 border border-[#b1dd00]/50 flex items-start gap-2">
              <span className="text-[#4a5e00] text-lg leading-none mt-0.5">✦</span>
              <p className="font-body text-body-md text-on-surface flex-1">{info}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              placeholder="you@magical.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<span>✉</span>}
              autoComplete="email"
              invalid={email.length > 0 && !isValidEmail(email)}
            />

            {!resetMode && (
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                icon={<span>🔒</span>}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                invalid={pwd.length > 0 && pwd.length < 6}
              />
            )}

            {!resetMode && mode === 'signin' && (
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true);
                    setError(null);
                    setInfo(null);
                  }}
                  className="font-label text-label-caps text-primary hover:text-primary-fixed-dim transition"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={!canSubmit}
              className="w-full"
            >
              {resetMode && '✉ Send reset link'}
              {!resetMode && mode === 'signin' && '✦ Sign in'}
              {!resetMode && mode === 'signup' && '✦ Create account'}
            </Button>
          </form>

          {!resetMode && (
            <>
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
            </>
          )}

          <p className="text-center mt-6 font-body text-body-md text-on-surface-variant">
            {resetMode && (
              <button
                onClick={() => {
                  setResetMode(false);
                  setError(null);
                  setInfo(null);
                }}
                className="text-primary font-semibold hover:underline"
              >
                ← Back to sign in
              </button>
            )}
            {!resetMode && mode === 'signin' && (
              <>
                New here?{' '}
                <button
                  onClick={() => switchMode('signup')}
                  className="text-primary font-semibold hover:underline"
                >
                  Create an account ✦
                </button>
              </>
            )}
            {!resetMode && mode === 'signup' && (
              <>
                Already a fairy?{' '}
                <button
                  onClick={() => switchMode('signin')}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign in instead
                </button>
              </>
            )}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
