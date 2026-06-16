import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { XP_PER_LEVEL } from '../data/mock';
import { Avatar } from './Avatar';

export function TopNav() {
  const loc = useLocation();
  const nav = useNavigate();
  const { session, signOut } = useAuth();
  const { profile } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const onDashboard = loc.pathname === '/dashboard';
  const onPrompt = loc.pathname === '/plan/new';

  const xpPct = profile
    ? ((profile.total_xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100
    : 0;
  const xpInLevel = profile ? profile.total_xp % XP_PER_LEVEL : 0;

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    nav('/plan/new', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 px-container-pad py-3">
      <div className="glass max-w-content mx-auto rounded-full flex items-center justify-between px-5 py-2.5">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <span className="font-display font-extrabold text-xl text-primary">
            ✦ Winx It!
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-3">
          {!onDashboard && !onPrompt && (
            <Link
              to="/dashboard"
              className="font-label text-label-caps uppercase text-on-surface-variant hover:text-primary transition"
            >
              ← Dashboard
            </Link>
          )}
          {onPrompt && (
            <Link
              to="/dashboard"
              className="font-label text-label-caps uppercase text-on-surface-variant hover:text-primary transition"
            >
              Dashboard →
            </Link>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/55">
            <span className="text-base">🔥</span>
            <span className="font-label text-label-caps text-on-surface">
              {profile?.current_streak ?? 0}d streak
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/55">
            <span className="font-label text-label-caps text-on-surface-variant">
              LV {profile?.level ?? 1}
            </span>
            <div className="w-20 h-1.5 rounded-full bg-primary/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <span className="font-label text-[10px] text-on-surface-variant">
              {xpInLevel}/{XP_PER_LEVEL}
            </span>
          </div>
        </div>

        <div className="relative">
          {session ? (
            <>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="Account menu"
              >
                <Avatar fairy={profile?.fairy ?? 'tecna'} size="sm" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 z-50">
                    <div className="glass-l3 rounded-lg p-2">
                      <div className="px-3 py-2">
                        <p className="font-display font-bold text-on-surface">
                          {profile?.name ?? 'Fairy'}
                        </p>
                        <p className="font-label text-label-caps text-on-surface-variant">
                          LV {profile?.level ?? 1}
                        </p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-3 py-2 mt-1 rounded font-label text-label-caps uppercase text-on-surface hover:bg-white/40 transition"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <Link
              to="/login"
              className="font-label text-label-caps uppercase text-primary hover:underline"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
