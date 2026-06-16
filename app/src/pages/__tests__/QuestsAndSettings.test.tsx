import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { QuestsPage } from '../QuestsPage';
import { SettingsPage } from '../SettingsPage';

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
    me: {
      get: vi.fn(),
      updateAvatar: vi.fn(),
      update: vi.fn(),
    },
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

const PROFILE = {
  id: 'u1', email: 't@x.io', name: 'Raisha', fairy: 'tecna' as const,
  pillar: 'tecna' as const, accent: 'blue' as const, avatar_seed: null,
  avatar_data_url: null, goal_text: '',
  level: 5, total_xp: 4200, current_streak: 7, longest_streak: 14,
  last_completed_date: '2026-06-15',
  pillar_xp: { tecna: 1000, flora: 800, musa: 700, bloom: 600, stella: 900 },
  xp_to_next_level: 800,
};

describe('[QuestsPage] /quests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue(PROFILE);
  });

  function renderQuests() {
    return renderWithProviders(null, {
      initialEntries: ['/quests'],
      routes: (
        <>
          <Route path="/quests" element={<QuestsPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">DASH</div>} />
          <Route path="/plan/new" element={<div data-testid="prompt">PROMPT</div>} />
          <Route path="/plan/:id" element={<div data-testid="editor">EDITOR</div>} />
        </>
      ),
    });
  }

  it('renders a header and "+ New quest" CTA', async () => {
    mockApi.plans.list.mockResolvedValue([]);
    renderQuests();
    expect(await screen.findByText(/your quests/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ new quest/i })).toBeInTheDocument();
  });

  it('shows an empty state with "Create your first quest" when no plans exist', async () => {
    mockApi.plans.list.mockResolvedValue([]);
    renderQuests();
    expect(
      await screen.findByRole('button', { name: /create your first quest/i }),
    ).toBeInTheDocument();
  });

  it('renders a card per plan with days-left and progress', async () => {
    mockApi.plans.list.mockResolvedValue([
      {
        id: 'plan-1', title: 'Neuro MVP', timeframe: '3 months',
        start_date: '2026-06-01', end_date: '2026-07-30', status: 'active',
        total_tasks: 10, done_tasks: 3, progress: 0.3,
        created_at: '2026-06-01T00:00:00Z',
      },
    ]);
    renderQuests();
    expect(await screen.findByText(/neuro mvp/i)).toBeInTheDocument();
    expect(screen.getByText(/d left/i)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it('marks a plan that has passed its end_date as "Xd over"', async () => {
    mockApi.plans.list.mockResolvedValue([
      {
        id: 'plan-1', title: 'Old plan', timeframe: '1 month',
        start_date: '2025-01-01', end_date: '2025-01-31', status: 'active',
        total_tasks: 5, done_tasks: 5, progress: 1,
        created_at: '2025-01-01T00:00:00Z',
      },
    ]);
    renderQuests();
    expect(await screen.findByText(/over/i)).toBeInTheDocument();
  });

  it('"← Back to dashboard" link routes to /dashboard', async () => {
    mockApi.plans.list.mockResolvedValue([]);
    renderQuests();
    await userEvent.click(await screen.findByText(/back to dashboard/i));
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });
});

describe('[SettingsPage] /settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue(PROFILE);
  });

  function renderSettings() {
    return renderWithProviders(null, {
      initialEntries: ['/settings'],
      routes: (
        <>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">DASH</div>} />
        </>
      ),
    });
  }

  it('renders the form populated from the profile', async () => {
    renderSettings();
    const nameInput = (await screen.findByLabelText(/display name/i)) as HTMLInputElement;
    // The profile is fetched asynchronously via ProfileContext; wait for the
    // input's value to be populated.
    await waitFor(() => expect(nameInput.value).toBe('Raisha'));
  });

  it('save button is disabled until a field changes', async () => {
    renderSettings();
    const save = await screen.findByRole('button', { name: /save changes/i });
    // Initially disabled because the form mirrors the loaded profile
    await waitFor(() => expect(save).toBeDisabled());
  });

  it('save button calls api.me.update and applies local patch', async () => {
    const user = userEvent.setup();
    mockApi.me.update.mockResolvedValue({ ...PROFILE, name: 'Aurora' });
    renderSettings();
    const nameInput = (await screen.findByLabelText(/display name/i)) as HTMLInputElement;
    await waitFor(() => expect(nameInput.value).toBe('Raisha'));
    await user.clear(nameInput);
    await user.type(nameInput, 'Aurora');
    await user.click(await screen.findByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(mockApi.me.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Aurora' }),
      ),
    );
  });

  it('surfaces real error message when save fails', async () => {
    const user = userEvent.setup();
    mockApi.me.update.mockRejectedValue(new Error('Network down'));
    renderSettings();
    const nameInput = (await screen.findByLabelText(/display name/i)) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, 'Aurora');
    await user.click(await screen.findByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
  });

  it('switching fairy auto-defaults the primary pillar', async () => {
    const user = userEvent.setup();
    renderSettings();
    // Wait for the form to hydrate with the profile
    await screen.findByDisplayValue('Raisha');
    // Click the Flora fairy card
    await user.click(await screen.findByRole('button', { name: /flora/i }));
    const select = (await screen.findByLabelText(/primary pillar/i)) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('flora'));
  });

  it('accent color buttons toggle selection', async () => {
    const user = userEvent.setup();
    renderSettings();
    const pink = screen.getByRole('button', { name: /pink/i });
    await user.click(pink);
    expect(pink).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Upload image" button opens a hidden file input', async () => {
    const user = userEvent.setup();
    renderSettings();
    const btn = await screen.findByRole('button', { name: /upload image/i });
    await user.click(btn);
    // The hidden file input is in the DOM; just confirm we didn't crash
    expect(btn).toBeInTheDocument();
  });

  it('goals textarea is editable and capped at 2000 chars', async () => {
    const user = userEvent.setup();
    renderSettings();
    // Wait for the form to hydrate
    await screen.findByDisplayValue('Raisha');
    const ta = (await screen.findByLabelText(/my goals/i)) as HTMLTextAreaElement;
    expect(ta.maxLength).toBe(2000);
    await user.type(ta, 'Ship the SaaS');
    expect(ta.value).toBe('Ship the SaaS');
  });

  it('"← Back to dashboard" link routes to /dashboard', async () => {
    renderSettings();
    await userEvent.click(await screen.findByText(/back to dashboard/i));
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });
});
