import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

type AuthOverrides = {
  signIn?: (...args: unknown[]) => Promise<{ error?: string }>;
  signUp?: (...args: unknown[]) => Promise<{ error?: string }>;
  signInWithOAuth?: (...args: unknown[]) => Promise<{ error?: string }>;
  signOut?: () => Promise<void>;
  isConfigured?: boolean;
  session?: null;
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

function makeRoutes(WelcomePage: React.ComponentType) {
  return (
    <>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
      <Route path="/signup" element={<div data-testid="signup-page">SIGNUP</div>} />
    </>
  );
}

function renderWelcome() {
  // Lazy-import so each test gets the latest mock state
  // (we re-import inside each test, but renderWelcome uses the import
  // pattern that matches the LoginPage test).
  return import('../WelcomePage').then(({ default: WelcomePage }) =>
    renderWithProviders(null, {
      initialEntries: ['/welcome'],
      routes: makeRoutes(WelcomePage),
    }),
  );
}

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
  });

  it('renders the Winx It! brand', async () => {
    await renderWelcome();
    expect(screen.getAllByText(/winx it/i).length).toBeGreaterThan(0);
  });

  it('shows a sign-in CTA', async () => {
    await renderWelcome();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows a create-account CTA', async () => {
    await renderWelcome();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows OAuth buttons for Google and GitHub', async () => {
    await renderWelcome();
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument();
  });

  it('clicking the sign-in CTA routes to /login', async () => {
    await renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });

  it('clicking the create-account CTA routes to /signup', async () => {
    await renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByTestId('signup-page')).toBeInTheDocument();
  });

  it('clicking Google calls signInWithOAuth with google', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({});
    mockAuth({ signInWithOAuth });
    await renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(signInWithOAuth).toHaveBeenCalledWith('google');
  });

  it('clicking GitHub calls signInWithOAuth with github', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({});
    mockAuth({ signInWithOAuth });
    await renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /github/i }));
    expect(signInWithOAuth).toHaveBeenCalledWith('github');
  });

  it('does NOT show a "Continue as guest" button', async () => {
    await renderWelcome();
    expect(screen.queryByRole('button', { name: /continue as guest|skip|just browse/i })).toBeNull();
  });
});
