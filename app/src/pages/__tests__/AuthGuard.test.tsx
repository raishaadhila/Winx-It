import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/AuthContext')>(
    '../../contexts/AuthContext',
  );
  return { ...actual, useAuth: vi.fn() };
});
import { useAuth } from '../../contexts/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
  },
}));

vi.mock('../../lib/api', () => ({
  api: {
    me: { get: vi.fn() },
  },
  ApiError: class ApiError extends Error { constructor(public status: number, public detail: string) { super(detail); } },
}));
import { api } from '../../lib/api';
const mockApi = vi.mocked(api);

type AuthOverrides = {
  session?: null | { access_token: string };
  user?: null;
  loading?: boolean;
};

function mockAuth(overrides: AuthOverrides = {}) {
  mockUseAuth.mockReturnValue({
    signIn: () => Promise.resolve({}),
    signUp: () => Promise.resolve({}),
    signInWithOAuth: () => Promise.resolve({}),
    resetPassword: () => Promise.resolve({}),
    signOut: () => Promise.resolve(),
    isConfigured: true,
    session: null,
    user: null,
    loading: false,
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

// We test the routing guard logic by mounting the guard at each entry
// path. The guard is the <RequireAuth> wrapper that redirects to /welcome.
import { RequireAuth } from '../RequireAuth';

function Guard({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

const ROUTES = (
  <>
    <Route path="/welcome" element={<div data-testid="welcome-page">WELCOME</div>} />
    <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
    <Route path="/onboarding" element={<div data-testid="onboarding-page">ONBOARDING</div>} />
    <Route path="/dashboard" element={
      <Guard>
        <div data-testid="dashboard-page">DASHBOARD</div>
      </Guard>
    } />
    <Route path="/plan/new" element={
      <Guard>
        <div data-testid="prompt-page">PROMPT</div>
      </Guard>
    } />
    <Route path="/" element={
      <Guard>
        <div data-testid="prompt-page">PROMPT</div>
      </Guard>
    } />
  </>
);

describe('Auth route guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unauthed user visiting /plan/new is redirected to /welcome', async () => {
    mockAuth();
    mockApi.me.get.mockResolvedValue({
      id: 'x', email: 'a@b.c', name: 'x', fairy: 'tecna', pillar: 'tecna', accent: 'blue',
      total_xp: 0, level: 1, current_streak: 0, longest_streak: 0,
      pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
      created_at: '2026-06-16', updated_at: '2026-06-16',
    });
    renderWithProviders(<></>, { initialEntries: ['/plan/new'], routes: ROUTES });
    expect(await screen.findByTestId('welcome-page')).toBeInTheDocument();
  });

  it('unauthed user visiting /dashboard is redirected to /welcome', async () => {
    mockAuth();
    mockApi.me.get.mockResolvedValue({} as never);
    renderWithProviders(<></>, { initialEntries: ['/dashboard'], routes: ROUTES });
    expect(await screen.findByTestId('welcome-page')).toBeInTheDocument();
  });

  it('unauthed user visiting / is redirected to /welcome', async () => {
    mockAuth();
    mockApi.me.get.mockResolvedValue({} as never);
    renderWithProviders(<></>, { initialEntries: ['/'], routes: ROUTES });
    expect(await screen.findByTestId('welcome-page')).toBeInTheDocument();
  });

  it('authed user WITH a profile visiting /plan/new sees the page', async () => {
    mockAuth({ session: { access_token: 'jwt' } });
    mockApi.me.get.mockResolvedValue({
      id: 'x', email: 'a@b.c', name: 'Test', fairy: 'tecna', pillar: 'tecna', accent: 'blue',
      total_xp: 0, level: 1, current_streak: 0, longest_streak: 0,
      pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
      created_at: '2026-06-16', updated_at: '2026-06-16',
    });
    renderWithProviders(<></>, { initialEntries: ['/plan/new'], routes: ROUTES });
    expect(await screen.findByTestId('prompt-page')).toBeInTheDocument();
  });

  it('authed user WITHOUT a profile visiting /plan/new is sent to /onboarding', async () => {
    mockAuth({ session: { access_token: 'jwt' } });
    // Profile is null/empty — api.me.get resolves with a profile that has
    // no name (which we treat as "not set up")
    mockApi.me.get.mockResolvedValue({
      id: 'x', email: 'a@b.c', name: '', fairy: 'tecna', pillar: 'tecna', accent: 'blue',
      total_xp: 0, level: 1, current_streak: 0, longest_streak: 0,
      pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
      created_at: '2026-06-16', updated_at: '2026-06-16',
    });
    renderWithProviders(<></>, { initialEntries: ['/plan/new'], routes: ROUTES });
    // Should NOT see the prompt page; should be redirected to onboarding
    await waitFor(() => {
      expect(screen.queryByTestId('prompt-page')).toBeNull();
    });
    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
  });
});
