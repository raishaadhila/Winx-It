import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { LoginPage } from '../LoginPage';

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/AuthContext')>(
    '../../contexts/AuthContext',
  );
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('../../lib/api', () => ({
  api: { me: { get: vi.fn() } },
  ApiError: class ApiError extends Error {},
}) as unknown as typeof import('../../lib/api'));

import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
const mockUseAuth = vi.mocked(useAuth);
const mockApi = vi.mocked(api);
const mockMeGet = mockApi.me.get as unknown as ReturnType<typeof vi.fn>;

type AuthOverrides = {
  signIn?: (...args: unknown[]) => Promise<{ error?: string }>;
  signUp?: (...args: unknown[]) => Promise<{ error?: string }>;
  signInWithOAuth?: (...args: unknown[]) => Promise<{ error?: string }>;
  resetPassword?: (...args: unknown[]) => Promise<{ error?: string }>;
  signOut?: () => Promise<void>;
  isConfigured?: boolean;
  session?: null;
  user?: null;
  loading?: boolean;
};

function mockAuth(overrides: AuthOverrides = {}) {
  const defaults = {
    signIn: () => Promise.resolve({}),
    signUp: () => Promise.resolve({}),
    signInWithOAuth: () => Promise.resolve({}),
    resetPassword: () => Promise.resolve({}),
    signOut: () => Promise.resolve(),
    isConfigured: true,
    session: null as null,
    user: null as null,
    loading: false,
  };
  mockUseAuth.mockReturnValue({ ...defaults, ...overrides } as ReturnType<typeof useAuth>);
}

const ROUTES = (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
    <Route path="/onboarding" element={<div data-testid="onboarding">Onboarding</div>} />
  </>
);

function renderLogin() {
  return renderWithProviders(null, {
    initialEntries: ['/login'],
    routes: ROUTES,
  });
}

describe('<LoginPage> flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the brand and form', () => {
    mockAuth();
    renderLogin();
    expect(screen.getByText(/winx it!/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows the Supabase-not-configured warning when not configured', () => {
    mockAuth({ isConfigured: false });
    renderLogin();
    expect(screen.getByText(/supabase not configured/i)).toBeInTheDocument();
  });

  it('submit button disabled until email + valid password', async () => {
    const user = userEvent.setup();
    mockAuth();
    renderLogin();
    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn).toBeDisabled();

    await user.type(screen.getByLabelText(/email/i), 'raisha@winx.dev');
    // Still disabled — password too short
    expect(btn).toBeDisabled();

    await user.type(screen.getByLabelText(/password/i), 'secret123');
    expect(btn).not.toBeDisabled();
  });

  it('calls signIn with email + password on submit', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({});
    mockAuth({ signIn });
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'raisha@winx.dev');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('raisha@winx.dev', 'secret123');
    });
    // Navigation to /dashboard happens in the session useEffect once
    // the auth state flips, which is tested separately in AuthGuard.test.tsx
  });

  it('shows error message when signIn fails', async () => {
    const user = userEvent.setup();
    mockAuth({ signIn: vi.fn().mockResolvedValue({ error: 'Invalid credentials' }) });
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'raisha@winx.dev');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument();
  });

  it('toggles to Sign up mode and calls signUp', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({});
    mockAuth({ signUp });
    renderLogin();

    await user.click(screen.getByRole('button', { name: /create an account/i }));
    expect(screen.getByText(/begin your transformation/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'new@winx.dev');
    await user.type(screen.getByLabelText(/password/i), 'newpass1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith('new@winx.dev', 'newpass1');
    });
  });

  it('OAuth button triggers the right provider', async () => {
    const user = userEvent.setup();
    const signInWithOAuth = vi.fn().mockResolvedValue({});
    mockAuth({ signInWithOAuth });
    renderLogin();

    await user.click(screen.getByRole('button', { name: /google/i }));
    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledWith('google');
    });
  });

  it('shows OAuth error as a dismissable alert', async () => {
    const user = userEvent.setup();
    mockAuth({
      signInWithOAuth: vi.fn().mockResolvedValue({ error: 'Google not enabled' }),
    });
    renderLogin();

    await user.click(screen.getByRole('button', { name: /google/i }));
    expect(await screen.findByText(/google not enabled/i)).toBeInTheDocument();
  });

  it('routes to /onboarding when session is set but profile is incomplete', async () => {
    // Session is truthy from the start so the useEffect runs on mount
    mockAuth({ session: { access_token: 'jwt' } as never });
    mockMeGet.mockResolvedValue({
      id: 'x', email: 'a@b.c', name: '', fairy: 'tecna' as const,
      pillar: 'tecna' as const, accent: 'blue' as const,
      total_xp: 0, level: 1, current_streak: 0, longest_streak: 0,
      pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
      created_at: '2026-06-16', updated_at: '2026-06-16',
    });

    const ROUTES = (
      <>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<div data-testid="onboarding">ONBOARDING</div>} />
        <Route path="/dashboard" element={<div data-testid="dashboard">DASHBOARD</div>} />
      </>
    );
    renderWithProviders(null, { initialEntries: ['/login'], routes: ROUTES });

    expect(await screen.findByTestId('onboarding')).toBeInTheDocument();
  });

  it('routes to /dashboard when session is set and profile is complete', async () => {
    mockAuth({ session: { access_token: 'jwt' } as never });
    mockMeGet.mockResolvedValue({
      id: 'x', email: 'a@b.c', name: 'Raisha', fairy: 'tecna' as const,
      pillar: 'tecna' as const, accent: 'blue' as const,
      total_xp: 0, level: 1, current_streak: 0, longest_streak: 0,
      pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
      created_at: '2026-06-16', updated_at: '2026-06-16',
    });

    const ROUTES = (
      <>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<div data-testid="onboarding">ONBOARDING</div>} />
        <Route path="/dashboard" element={<div data-testid="dashboard">DASHBOARD</div>} />
      </>
    );
    renderWithProviders(null, { initialEntries: ['/login'], routes: ROUTES });

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });
});
