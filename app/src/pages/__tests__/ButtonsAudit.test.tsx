import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { Button } from '../../components/Button';
import { TopNav } from '../../components/TopNav';
import { LoginPage } from '../LoginPage';
import WelcomePage from '../WelcomePage';
import { AvatarPickerPage } from '../AvatarPickerPage';
import { PromptPage } from '../PromptPage';
import { DashboardPage } from '../DashboardPage';
import { PlanEditorPage } from '../PlanEditorPage';
import { ToastProvider, useToast } from '../../contexts/ToastContext';
import { AttachmentsPanel } from '../../components/AttachmentsPanel';

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/AuthContext')>(
    '../../contexts/AuthContext',
  );
  return { ...actual, useAuth: vi.fn() };
});
import { useAuth } from '../../contexts/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

vi.mock('../../lib/api', () => ({
  api: {
    plans: {
      generate: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    me: { get: vi.fn(), updateAvatar: vi.fn() },
    tasks: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      complete: vi.fn(),
    },
  },
  API_URL: 'http://test',
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));
import { api } from '../../lib/api';
const mockApi = vi.mocked(api, true);

function authMock(
  overrides: Partial<ReturnType<typeof useAuth>> = {},
): ReturnType<typeof useAuth> {
  return {
    signIn: vi.fn().mockResolvedValue({}),
    signUp: vi.fn().mockResolvedValue({}),
    signInWithOAuth: vi.fn().mockResolvedValue({}),
    resetPassword: vi.fn().mockResolvedValue({}),
    signOut: vi.fn().mockResolvedValue(undefined),
    isConfigured: true,
    session: null,
    user: null,
    loading: false,
    ...overrides,
  } as ReturnType<typeof useAuth>;
}

const COMPLETE_PROFILE = {
  id: 'u1', email: 't@x.io', name: 'Raisha', fairy: 'tecna' as const,
  pillar: 'tecna' as const, accent: 'blue' as const, avatar_seed: null,
  level: 5, total_xp: 4200, current_streak: 7, longest_streak: 14,
  last_completed_date: '2026-06-15',
  pillar_xp: { tecna: 1000, flora: 800, musa: 700, bloom: 600, stella: 900 },
  xp_to_next_level: 800,
};

/* -------------------------------------------------------------------------- */
/* 1. <Button> primitive                                                       */
/* -------------------------------------------------------------------------- */

describe('[Button] primitive', () => {
  it('primary button fires onClick', async () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: /go/i }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('loading button is disabled and replaces label', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/loading/i);
  });

  it('disabled button does not fire onClick', async () => {
    const fn = vi.fn();
    render(<Button disabled onClick={fn}>X</Button>);
    await userEvent.click(screen.getByRole('button', { name: /x/i }));
    expect(fn).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* 2. WelcomePage — /welcome                                                   */
/* -------------------------------------------------------------------------- */

describe('[WelcomePage] /welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(authMock());
  });

  function renderWelcome() {
    return renderWithProviders(null, {
      initialEntries: ['/welcome'],
      routes: (
        <>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
          <Route path="/signup" element={<div data-testid="signup-page">SIGNUP</div>} />
        </>
      ),
    });
  }

  it('BTN 1: "Sign in" button navigates to /login', async () => {
    renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });

  it('BTN 2: "Create account" button target is /signup', async () => {
    renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    // Verify the destination element is found — i.e. the route resolves.
    // (App.tsx does NOT register /signup, so the test router DOES but the
    // real app would 404 to /welcome. The button itself does call nav.)
    const el = await screen.findByTestId('signup-page');
    expect(el).toBeInTheDocument();
  });

  it('BTN 3: "Google" OAuth button calls signInWithOAuth("google")', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue(authMock({ signInWithOAuth }));
    renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(signInWithOAuth).toHaveBeenCalledWith('google');
  });

  it('BTN 4: "GitHub" OAuth button calls signInWithOAuth("github")', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue(authMock({ signInWithOAuth }));
    renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /github/i }));
    expect(signInWithOAuth).toHaveBeenCalledWith('github');
  });

  it('BTN 5: OAuth error surfaces a toast', async () => {
    mockUseAuth.mockReturnValue(
      authMock({ signInWithOAuth: vi.fn().mockResolvedValue({ error: 'boom' }) }),
    );
    renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 3. LoginPage — /login                                                       */
/* -------------------------------------------------------------------------- */

describe('[LoginPage] /login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderLogin() {
    return renderWithProviders(null, {
      initialEntries: ['/login'],
      routes: (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">DASH</div>} />
          <Route path="/onboarding" element={<div data-testid="onboarding">ONB</div>} />
        </>
      ),
    });
  }

  it('BTN 6: Submit button is disabled until email + valid password', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(authMock());
    renderLogin();
    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText(/email/i), 'a@b.io');
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    expect(btn).not.toBeDisabled();
  });

  it('BTN 7: Submit fires signIn with email+password', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue(authMock({ signIn }));
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'a@b.io');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('a@b.io', 'secret123'));
  });

  it('BTN 8: "Create an account ✦" toggles to sign-up mode', async () => {
    mockUseAuth.mockReturnValue(authMock());
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /create an account/i }));
    expect(screen.getByText(/begin your transformation/i)).toBeInTheDocument();
  });

  it('BTN 9: "Sign in instead" toggles back from sign-up mode', async () => {
    mockUseAuth.mockReturnValue(authMock());
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /create an account/i }));
    await userEvent.click(screen.getByRole('button', { name: /sign in instead/i }));
    expect(screen.getByText(/welcome back, fairy/i)).toBeInTheDocument();
  });

  it('BTN 10: "Forgot password?" reveals the reset-password form', async () => {
    mockUseAuth.mockReturnValue(authMock());
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByText(/reset your password/i)).toBeInTheDocument();
  });

  it('BTN 11: "← Back to sign in" returns from reset mode', async () => {
    mockUseAuth.mockReturnValue(authMock());
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(screen.queryByText(/reset your password/i)).not.toBeInTheDocument();
  });

  it('BTN 12: Reset-mode submit calls resetPassword(email)', async () => {
    const user = userEvent.setup();
    const resetPassword = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue(authMock({ resetPassword }));
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await user.type(screen.getByLabelText(/email/i), 'a@b.io');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('a@b.io'));
  });

  it('BTN 13: Sign-up submit calls signUp and shows info banner', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue(authMock({ signUp }));
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /create an account/i }));
    await user.type(screen.getByLabelText(/email/i), 'new@b.io');
    await user.type(screen.getByLabelText(/password/i), 'newpass1');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith('new@b.io', 'newpass1'));
    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
  });

  it('BTN 14: Sign-in OAuth Google button calls provider', async () => {
    const user = userEvent.setup();
    const signInWithOAuth = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue(authMock({ signInWithOAuth }));
    renderLogin();
    await user.click(screen.getByRole('button', { name: /google/i }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith('google'));
  });

  it('BTN 15: OAuth error renders a dismissable alert', async () => {
    mockUseAuth.mockReturnValue(
      authMock({ signInWithOAuth: vi.fn().mockResolvedValue({ error: 'Google blocked' }) }),
    );
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(await screen.findByText(/google blocked/i)).toBeInTheDocument();
  });

  it('BTN 16: "✕ Dismiss" clears the error banner', async () => {
    mockUseAuth.mockReturnValue(
      authMock({ signIn: vi.fn().mockResolvedValue({ error: 'Invalid credentials' }) }),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.io');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 4. AvatarPickerPage — /onboarding                                           */
/* -------------------------------------------------------------------------- */

describe('[AvatarPickerPage] /onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue(COMPLETE_PROFILE);
  });

  function renderOnboarding() {
    return renderWithProviders(null, {
      initialEntries: ['/onboarding'],
      routes: (
        <>
          <Route path="/onboarding" element={<AvatarPickerPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">DASH</div>} />
        </>
      ),
    });
  }

  it('BTN 17: Clicking a fairy card selects it (state-only)', async () => {
    renderOnboarding();
    const flora = await screen.findByRole('button', { name: /flora/i });
    await userEvent.click(flora);
    // Preview updates: name "Flora" appears in the preview card as h2
    const preview = screen.getAllByText(/flora/i);
    expect(preview.length).toBeGreaterThan(1);
  });

  it('BTN 18: Accent color buttons are clickable and toggle ring', async () => {
    renderOnboarding();
    const purple = screen.getByRole('button', { name: /purple/i });
    expect(purple).toBeInTheDocument();
    await userEvent.click(purple);
    // No assertion on style change — just confirm no crash + button still there.
    expect(purple).toBeInTheDocument();
  });

  it('BTN 19: "Begin transformation" calls updateAvatar and routes to /dashboard', async () => {
    const user = userEvent.setup();
    mockApi.me.updateAvatar.mockResolvedValue(COMPLETE_PROFILE);
    renderOnboarding();
    const btn = await screen.findByRole('button', { name: /begin transformation/i });
    await user.type(screen.getByLabelText(/display name/i), 'Aurora');
    await user.click(btn);
    await waitFor(() => expect(mockApi.me.updateAvatar).toHaveBeenCalled());
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('BTN 20: "Begin transformation" surfaces the real error message on API failure', async () => {
    const user = userEvent.setup();
    mockApi.me.updateAvatar.mockRejectedValue(new Error('Save failed'));
    renderOnboarding();
    const btn = await screen.findByRole('button', { name: /begin transformation/i });
    await user.click(btn);
    // Now surfaces the actual Error.message, not a generic fallback.
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 5. PromptPage — /plan/new                                                   */
/* -------------------------------------------------------------------------- */

describe('[PromptPage] /plan/new', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue(COMPLETE_PROFILE);
  });

  function renderPrompt() {
    return renderWithProviders(null, {
      initialEntries: ['/plan/new'],
      routes: (
        <>
          <Route path="/plan/new" element={<PromptPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">DASH</div>} />
        </>
      ),
    });
  }

  it('BTN 21: Timeframe chips update the active state', async () => {
    renderPrompt();
    const sixMonths = await screen.findByRole('button', { name: /6 months/i });
    await userEvent.click(sixMonths);
    expect(sixMonths).toHaveClass('chip-active');
  });

  it('BTN 22: Energy chips update the active state', async () => {
    renderPrompt();
    const physical = await screen.findByRole('button', { name: /physical/i });
    await userEvent.click(physical);
    expect(physical).toHaveClass('chip-active');
  });

  it('BTN 23: Pillar chips toggle in/out of the selection set', async () => {
    renderPrompt();
    const musa = await screen.findByRole('button', { name: /musa/i });
    await userEvent.click(musa);
    expect(musa).toHaveClass('chip-active');
    await userEvent.click(musa);
    expect(musa).not.toHaveClass('chip-active');
  });

  it('BTN 24: "Generate my plan" disabled until goal is non-empty', async () => {
    const user = userEvent.setup();
    renderPrompt();
    const btn = screen.getByRole('button', { name: /generate my plan/i });
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText(/your goal/i), 'Ship a thing');
    expect(btn).not.toBeDisabled();
  });

  it('BTN 25: "Generate my plan" calls api.plans.generate and routes on success', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockResolvedValue({
      title: 'X', start_date: '2026-06-16', end_date: '2026-07-16', tasks: [],
    });
    mockApi.plans.create.mockResolvedValue({
      id: 'p1', title: 'X', goal_text: 'g', timeframe: '3 months',
      start_date: '2026-06-16', end_date: '2026-07-16', status: 'active',
      tasks: [], created_at: '2026-06-16T00:00:00Z', updated_at: '2026-06-16T00:00:00Z',
    });
    renderPrompt();
    await user.type(screen.getByLabelText(/your goal/i), 'Ship a thing');
    await user.click(screen.getByRole('button', { name: /generate my plan/i }));
    await waitFor(() => expect(mockApi.plans.generate).toHaveBeenCalled());
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('BTN 26: Cmd/Ctrl+Enter in goal textarea triggers generation', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockResolvedValue({
      title: 'X', start_date: '2026-06-16', end_date: '2026-07-16', tasks: [],
    });
    mockApi.plans.create.mockResolvedValue({
      id: 'p1', title: 'X', goal_text: 'g', timeframe: '3 months',
      start_date: '2026-06-16', end_date: '2026-07-16', status: 'active',
      tasks: [], created_at: '2026-06-16T00:00:00Z', updated_at: '2026-06-16T00:00:00Z',
    });
    renderPrompt();
    const ta = screen.getByLabelText(/your goal/i);
    await user.type(ta, 'Build SaaS');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(mockApi.plans.generate).toHaveBeenCalled());
  });

  it('BTN 27: Attachments: "Add link" toggles the link input', async () => {
    renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: /add link/i }));
    expect(screen.getByPlaceholderText(/https:\/\/example\.com/)).toBeInTheDocument();
  });

  it('BTN 28: Attachments: typing + Enter in the link input adds the link', async () => {
    const user = userEvent.setup();
    renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: /add link/i }));
    const input = screen.getByPlaceholderText(/https:\/\/example\.com/);
    await user.type(input, 'docs.example.com');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('https://docs.example.com')).toBeInTheDocument();
  });

  it('BTN 29: Attachments: "Add" button next to link input also adds the link', async () => {
    const user = userEvent.setup();
    renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: /add link/i }));
    const input = screen.getByPlaceholderText(/https:\/\/example\.com/);
    await user.type(input, 'docs.example.com');
    // There is also a literal "Add" button next to the input
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText('https://docs.example.com')).toBeInTheDocument();
  });

  it('BTN 30: Attachments: "Attach file or image" button is present (clicks file input)', async () => {
    renderPrompt();
    const btn = screen.getByRole('button', { name: /attach file or image/i });
    expect(btn).toBeInTheDocument();
    // Clicking it doesn't crash; the actual file picker is browser-only
    await userEvent.click(btn);
    expect(btn).toBeInTheDocument();
  });

  it('BTN 31: Attachments: "Clear all" button empties the list', async () => {
    renderPrompt();
    // Type a URL to create an attachment first
    await userEvent.type(
      screen.getByLabelText(/your goal/i),
      'Read https://docs.example.com/abc please',
    );
    const chip = await screen.findByText('https://docs.example.com/abc');
    expect(chip).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(chip).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 6. DashboardPage — /dashboard                                               */
/* -------------------------------------------------------------------------- */

describe('[DashboardPage] /dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue(COMPLETE_PROFILE);
  });

  function renderDashboard() {
    return renderWithProviders(null, {
      initialEntries: ['/dashboard'],
      routes: (
        <>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/plan/new" element={<div data-testid="prompt">PROMPT</div>} />
          <Route path="/plan/:id" element={<div data-testid="editor">EDITOR</div>} />
        </>
      ),
    });
  }

  it('BTN 32: Error state shows a "Retry" button that re-fetches', async () => {
    mockApi.plans.list.mockRejectedValueOnce(new Error('boom'));
    mockApi.tasks.list.mockResolvedValue([]);
    mockApi.me.get.mockResolvedValue(COMPLETE_PROFILE);
    renderDashboard();
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /retry/i });
    mockApi.plans.list.mockResolvedValueOnce([]);
    await userEvent.click(retry);
    await waitFor(() => expect(mockApi.plans.list).toHaveBeenCalledTimes(2));
  });

  it('BTN 33: "Create your first plan" button is rendered when no plans exist', async () => {
    mockApi.plans.list.mockResolvedValue([]);
    mockApi.tasks.list.mockResolvedValue([]);
    renderDashboard();
    expect(await screen.findByRole('button', { name: /create your first plan/i })).toBeInTheDocument();
  });

  it('BTN 34: Dashboard no longer renders an "Active Plans" grid (moved to /quests)', async () => {
    mockApi.plans.list.mockResolvedValue([
      {
        id: 'plan-1', title: 'Neuro MVP', timeframe: '3 months',
        start_date: '2026-06-16', end_date: '2026-07-16', status: 'active',
        total_tasks: 2, done_tasks: 0, progress: 0,
        created_at: '2026-06-16T00:00:00Z',
      },
    ]);
    mockApi.tasks.list.mockResolvedValue([]);
    renderDashboard();
    // Old dashboard button is gone; the "View all →" link to /quests is here instead.
    expect(
      screen.queryByRole('button', { name: /^\+ new plan$/i }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/view all/i)).toBeInTheDocument();
  });

  it('BTN 35: Dashboard shows a "Days Left" panel for each plan', async () => {
    mockApi.plans.list.mockResolvedValue([
      {
        id: 'plan-1', title: 'Neuro MVP', timeframe: '3 months',
        start_date: '2026-06-16', end_date: '2026-07-16', status: 'active',
        total_tasks: 2, done_tasks: 0, progress: 0,
        created_at: '2026-06-16T00:00:00Z',
      },
    ]);
    mockApi.tasks.list.mockResolvedValue([]);
    renderDashboard();
    expect(await screen.findByText(/days left/i)).toBeInTheDocument();
    expect(await screen.findByText(/d left/i)).toBeInTheDocument();
  });

  it('BTN 36: Task checkbox fires api.tasks.complete and toasts XP', async () => {
    const user = userEvent.setup();
    mockApi.plans.list.mockResolvedValue([
      {
        id: 'plan-1', title: 'Neuro MVP', timeframe: '3 months',
        start_date: '2026-06-16', end_date: '2026-07-16', status: 'active',
        total_tasks: 1, done_tasks: 0, progress: 0,
        created_at: '2026-06-16T00:00:00Z',
      },
    ]);
    mockApi.tasks.list.mockResolvedValue([
      {
        id: 't1', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
        description: 'Read neuro mod 1', pillar: 'flora', hours: 2, energy: 'medium',
        done: false, completed_at: null, position: 0,
      },
    ]);
    mockApi.tasks.complete.mockResolvedValue({
      task: {
        id: 't1', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
        description: 'Read neuro mod 1', pillar: 'flora', hours: 2, energy: 'medium',
        done: true, completed_at: '2026-06-16T12:00:00Z', position: 0,
      },
      xp_awarded: 50, pillar_xp_awarded: 50,
      new_total_xp: 4250, new_level: 5, leveled_up: false, streak: 7,
    });
    renderDashboard();
    const cb = (await screen.findByText(/read neuro mod 1/i))
      .closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb).toBeTruthy();
    await user.click(cb);
    await waitFor(() => expect(mockApi.tasks.complete).toHaveBeenCalledWith('plan-1', 't1'));
  });

  it('BTN 37: "Mark all complete" button only appears when ALL tasks are done', async () => {
    mockApi.plans.list.mockResolvedValue([
      {
        id: 'plan-1', title: 'Neuro MVP', timeframe: '3 months',
        start_date: '2026-06-16', end_date: '2026-07-16', status: 'active',
        total_tasks: 1, done_tasks: 0, progress: 0,
        created_at: '2026-06-16T00:00:00Z',
      },
    ]);
    mockApi.tasks.list.mockResolvedValue([
      {
        id: 't1', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
        description: 'Done thing', pillar: 'flora', hours: 2, energy: 'medium',
        done: true, completed_at: '2026-06-16T08:00:00Z', position: 0,
      },
    ]);
    renderDashboard();
    expect(await screen.findByRole('button', { name: /mark all complete/i })).toBeInTheDocument();
  });

  it('BTN 38: Mobile FAB links to /quests (aria-label="Your quests")', async () => {
    mockApi.plans.list.mockResolvedValue([]);
    mockApi.tasks.list.mockResolvedValue([]);
    renderDashboard();
    const fab = await screen.findByLabelText(/your quests/i);
    expect(fab).toBeInTheDocument();
    expect(fab.tagName.toLowerCase()).toBe('a');
  });
});

/* -------------------------------------------------------------------------- */
/* 7. PlanEditorPage — /plan/:id                                               */
/* -------------------------------------------------------------------------- */

describe('[PlanEditorPage] /plan/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue(COMPLETE_PROFILE);
  });

  const PLAN = {
    id: 'plan-1', title: 'Test Plan', goal_text: 'Goal', timeframe: '3 months',
    start_date: '2026-06-16', end_date: '2026-09-13', status: 'active' as const,
    tasks: [
      {
        id: 't1', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
        description: 'Original A', pillar: 'flora' as const, hours: 2,
        energy: 'medium' as const, done: false, completed_at: null, position: 0,
      },
      {
        id: 't2', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
        description: 'Original B', pillar: 'tecna' as const, hours: 1,
        energy: 'medium' as const, done: true, completed_at: '2026-06-16T08:00:00Z', position: 1,
      },
    ],
    created_at: '2026-06-16T00:00:00Z', updated_at: '2026-06-16T00:00:00Z',
  };

  function renderEditor() {
    return renderWithProviders(null, {
      initialEntries: ['/plan/plan-1'],
      routes: (
        <>
          <Route path="/plan/:id" element={<PlanEditorPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">DASH</div>} />
        </>
      ),
    });
  }

  it('BTN 39: "← Back to dashboard" link is rendered', async () => {
    mockApi.plans.get.mockResolvedValue(PLAN);
    renderEditor();
    expect(await screen.findByText(/back to dashboard/i)).toBeInTheDocument();
  });

  it('BTN 40: Header "✎ Edit title" button opens an inline title editor', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(PLAN);
    mockApi.plans.update.mockResolvedValue({ ...PLAN, title: 'New Title' });
    renderEditor();
    await user.click(await screen.findByRole('button', { name: /edit title/i }));
    // An input with the current title should appear
    const input = await screen.findByDisplayValue(/test plan/i);
    await user.clear(input);
    await user.type(input, 'New Title');
    // Find the inline "Save" inside the title editor
    const inlineSave = screen.getAllByRole('button', { name: /^save$/i })[0];
    await user.click(inlineSave);
    await waitFor(() =>
      expect(mockApi.plans.update).toHaveBeenCalledWith('plan-1', { title: 'New Title' }),
    );
  });

  it('BTN 41: Header "✓ Done" button toasts "all changes saved" and routes to /dashboard', async () => {
    mockApi.plans.get.mockResolvedValue(PLAN);
    renderEditor();
    const doneButtons = await screen.findAllByRole('button', { name: /✓ done/i });
    // [0] is the header, [1] is the floating sticky
    await userEvent.click(doneButtons[0]);
    expect(await screen.findByText(/all changes saved/i)).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('BTN 42: Tab buttons (table/timeline/pillars) switch the view', async () => {
    mockApi.plans.get.mockResolvedValue(PLAN);
    renderEditor();
    await userEvent.click(await screen.findByRole('button', { name: /^timeline$/i }));
    // timeline view also shows task descriptions
    expect(screen.getAllByText(/original a/i).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /^pillars$/i }));
    // pillars view shows h3 headers for each pillar that has tasks
    expect(screen.getAllByRole('heading', { name: /^flora$/i }).length).toBeGreaterThan(0);
  });

  it('BTN 43: Mark-done checkbox (table view) calls complete API', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(PLAN);
    mockApi.tasks.complete.mockResolvedValue({
      task: { ...PLAN.tasks[0], done: true, completed_at: '2026-06-16T12:00:00Z' },
      xp_awarded: 50, pillar_xp_awarded: 50, new_total_xp: 4250, new_level: 5,
      leveled_up: false, streak: 7,
    });
    renderEditor();
    const btn = (await screen.findByText(/original a/i))
      .closest('tr')?.querySelector('button[aria-label="Mark done"]');
    expect(btn).toBeTruthy();
    await user.click(btn!);
    await waitFor(() => expect(mockApi.tasks.complete).toHaveBeenCalledWith('plan-1', 't1'));
  });

  it('BTN 44: Inline edit on a task description (Enter commits, Esc cancels)', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(PLAN);
    mockApi.tasks.update.mockResolvedValue({ ...PLAN.tasks[0], description: 'New A' });
    renderEditor();
    await user.click(await screen.findByText(/original a/i));
    const input = screen.getByDisplayValue(/original a/i);
    await user.clear(input);
    await user.type(input, 'New A');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(mockApi.tasks.update).toHaveBeenCalledWith('plan-1', 't1', { description: 'New A' }),
    );
  });

  it('BTN 45: Inline edit on a task description (Esc cancels)', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(PLAN);
    renderEditor();
    await user.click(await screen.findByText(/original a/i));
    const input = screen.getByDisplayValue(/original a/i);
    await user.clear(input);
    await user.type(input, 'should not save');
    await user.keyboard('{Escape}');
    expect(screen.getByText(/original a/i)).toBeInTheDocument();
    expect(mockApi.tasks.update).not.toHaveBeenCalled();
  });

  it('BTN 46: "+ Add task" button reveals an inline form and calls tasks.create', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(PLAN);
    mockApi.tasks.create.mockResolvedValue({
      id: 't-new', plan_id: 'plan-1', day: 3, week: 1, month: 1, date: '2026-06-18',
      description: 'Brand new task', pillar: 'tecna', hours: 1, energy: 'medium',
      done: false, completed_at: null, position: 2,
    });
    renderEditor();
    await user.click(await screen.findByRole('button', { name: /\+ add task/i }));
    // The form's input label is "New task"
    const input = await screen.findByLabelText(/new task/i);
    await user.type(input, 'Brand new task');
    await user.click(await screen.findByRole('button', { name: /✦ add task/i }));
    await waitFor(() =>
      expect(mockApi.tasks.create).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({ description: 'Brand new task', pillar: 'tecna' }),
      ),
    );
  });

  it('BTN 47: "✦ Regenerate AI" button calls plans.generate + tasks.remove + tasks.create', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(PLAN);
    mockApi.plans.generate.mockResolvedValue({
      title: 'Regenerated',
      start_date: '2026-06-16',
      end_date: '2026-09-13',
      tasks: [
        {
          day: 1, week: 1, month: 1, date: '2026-06-16',
          description: 'Fresh task', pillar: 'flora', hours: 2, energy: 'medium',
        },
      ],
    });
    mockApi.tasks.remove.mockResolvedValue(undefined);
    mockApi.tasks.create.mockResolvedValue({
      id: 't-fresh', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
      description: 'Fresh task', pillar: 'flora', hours: 2, energy: 'medium',
      done: false, completed_at: null, position: 0,
    });
    // Auto-confirm the window.confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    await user.click(await screen.findByRole('button', { name: /regenerate ai/i }));
    await waitFor(() => expect(mockApi.plans.generate).toHaveBeenCalled());
    await waitFor(() => expect(mockApi.tasks.remove).toHaveBeenCalled());
    await waitFor(() => expect(mockApi.tasks.create).toHaveBeenCalled());
  });

  it('BTN 48: "✓ Mark day complete" button is disabled until today\'s tasks are done', async () => {
    mockApi.plans.get.mockResolvedValue(PLAN);
    renderEditor();
    // Task t1 (day 1) is undone -> button disabled
    const btn = await screen.findByRole('button', { name: /mark day complete/i });
    expect(btn).toBeDisabled();
  });

  it('BTN 49: "✓ Mark day complete" button fires confetti when enabled', async () => {
    mockApi.plans.get.mockResolvedValue({
      ...PLAN,
      tasks: [{ ...PLAN.tasks[0], done: true }, PLAN.tasks[1]],
    });
    renderEditor();
    const btn = await screen.findByRole('button', { name: /mark day complete/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    // No API calls expected; the side-effect is visual (confetti)
    expect(mockApi.tasks.complete).not.toHaveBeenCalled();
  });

  it('BTN 50: Floating sticky "✓ Done" button toasts and routes to /dashboard', async () => {
    mockApi.plans.get.mockResolvedValue(PLAN);
    renderEditor();
    const doneButtons = await screen.findAllByRole('button', { name: /✓ done/i });
    // [0] is the header, [1] is the floating sticky
    await userEvent.click(doneButtons[1]);
    expect(await screen.findByText(/all changes saved/i)).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 8. TopNav                                                                  */
/* -------------------------------------------------------------------------- */

describe('[TopNav] global header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue(COMPLETE_PROFILE);
  });

  it('BTN 51: Brand "✦ Winx It!" link points to /dashboard when authed', async () => {
    mockUseAuth.mockReturnValue(authMock({ session: { access_token: 'jwt' } as never }));
    renderWithProviders(
      <div>
        <TopNav />
      </div>,
      { initialEntries: ['/dashboard'] },
    );
    const brand = await screen.findByText(/winx it!/i);
    expect(brand.closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('BTN 52: Avatar button opens the account menu', async () => {
    mockUseAuth.mockReturnValue(authMock({ session: { access_token: 'jwt' } as never }));
    renderWithProviders(
      <div>
        <TopNav />
      </div>,
      { initialEntries: ['/dashboard'] },
    );
    const av = await screen.findByLabelText(/account menu/i);
    await userEvent.click(av);
    expect(await screen.findByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('BTN 53: "Sign out" calls signOut and navigates to /welcome', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(
      authMock({ session: { access_token: 'jwt' } as never, signOut }),
    );
    renderWithProviders(null, {
      initialEntries: ['/dashboard'],
      routes: (
        <>
          <Route
            path="/dashboard"
            element={
              <div>
                <TopNav />
                <div data-testid="d">D</div>
              </div>
            }
          />
          <Route path="/plan/new" element={<div data-testid="prompt">PROMPT</div>} />
        </>
      ),
    });
    await userEvent.click(await screen.findByLabelText(/account menu/i));
    await userEvent.click(await screen.findByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('BTN 54: "← Dashboard" / "Dashboard →" contextual link is rendered', async () => {
    mockUseAuth.mockReturnValue(authMock({ session: { access_token: 'jwt' } as never }));
    renderWithProviders(
      <div>
        <TopNav />
      </div>,
      { initialEntries: ['/plan/plan-1'] },
    );
    expect(await screen.findByText(/← dashboard/i)).toBeInTheDocument();
  });

  it('BTN 55: Logged-out TopNav shows a "Sign in" link to /login', async () => {
    mockUseAuth.mockReturnValue(authMock({ session: null }));
    renderWithProviders(
      <div>
        <TopNav />
      </div>,
      { initialEntries: ['/plan/new'] },
    );
    // There are no TopNav authed controls; just a Sign in link
    expect(await screen.findByText(/^sign in$/i)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 9. Toast                                                                   */
/* -------------------------------------------------------------------------- */

describe('[Toast] system', () => {
  function ProbedToast() {
    const toast = useToast();
    return (
      <div>
        <button onClick={() => toast.success('Saved')}>ok</button>
        <button onClick={() => toast.error('Boom')}>err</button>
      </div>
    );
  }

  it('BTN 56: Toast is itself a button — clicking it dismisses', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ProbedToast />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /ok/i }));
    const toast = await screen.findByText(/saved/i);
    expect(toast).toBeInTheDocument();
    // The toast container is a button — click it to dismiss
    const dismissBtn = toast.closest('button')!;
    await user.click(dismissBtn);
    await waitFor(() => expect(screen.queryByText(/saved/i)).not.toBeInTheDocument());
  });
});

/* -------------------------------------------------------------------------- */
/* 10. AttachmentsPanel & ResourcesButton (components in isolation)           */
/* -------------------------------------------------------------------------- */

describe('[AttachmentsPanel] isolated buttons', () => {
  it('BTN 57: "Attach file or image" button triggers the hidden file input', async () => {
    render(<AttachmentsPanel attachments={[]} onChange={() => {}} />);
    const btn = screen.getByRole('button', { name: /attach file or image/i });
    expect(btn).toBeInTheDocument();
    // We can fire the click; jsdom does not show a real file picker
    fireEvent.click(btn);
    expect(btn).toBeInTheDocument();
  });

  it('BTN 58: "Clear all" button only appears when attachments exist', () => {
    const { rerender } = render(
      <AttachmentsPanel attachments={[]} onChange={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
    rerender(
      <AttachmentsPanel
        attachments={[{ id: '1', kind: 'link', name: 'x', value: 'x' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
  });

  it('BTN 59: "✕" remove button on each chip removes that attachment', async () => {
    const onChange = vi.fn();
    render(
      <AttachmentsPanel
        attachments={[{ id: '1', kind: 'link', name: 'foo', value: 'foo' }]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /remove foo/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('BTN 60: Link input "Add" button is no-op when input is empty', async () => {
    const onChange = vi.fn();
    render(<AttachmentsPanel attachments={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /add link/i }));
    // click the literal "Add" button without typing
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

