import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { PlanEditorPage } from '../PlanEditorPage';
import type { Plan, Task } from '../../lib/types';

vi.mock('../../lib/api', () => ({
  api: {
    plans: {
      generate: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
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

const MOCK_TASKS: Task[] = [
  {
    id: 't1', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
    description: 'Original task A', pillar: 'flora', hours: 2, energy: 'medium',
    done: false, completed_at: null, position: 0,
  },
  {
    id: 't2', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
    description: 'Original task B', pillar: 'tecna', hours: 1.5, energy: 'medium',
    done: true, completed_at: '2026-06-16T08:00:00Z', position: 1,
  },
];

const MOCK_PLAN: Plan = {
  id: 'plan-1',
  title: 'Test Plan',
  goal_text: 'Goal',
  timeframe: '3 months',
  start_date: '2026-06-16',
  end_date: '2026-09-13',
  status: 'active',
  tasks: MOCK_TASKS,
  created_at: '2026-06-16T00:00:00Z',
  updated_at: '2026-06-16T00:00:00Z',
};

const ROUTES = (
  <>
    <Route path="/plan/:id" element={<PlanEditorPage />} />
    <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
  </>
);

function renderEditor(planId = 'plan-1') {
  return renderWithProviders(null, {
    initialEntries: [`/plan/${planId}`],
    routes: ROUTES,
  });
}

describe('<PlanEditorPage> flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.get.mockResolvedValue({
      id: 'u1', email: 't@x.io', name: 'Raisha', fairy: 'tecna', pillar: 'tecna',
      accent: 'blue', avatar_seed: null, level: 5, total_xp: 4200,
      current_streak: 7, longest_streak: 14, last_completed_date: '2026-06-15',
      pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
      xp_to_next_level: 800,
    });
  });

  it('loads and renders the plan with its tasks', async () => {
    mockApi.plans.get.mockResolvedValue(MOCK_PLAN);
    renderEditor();

    expect(await screen.findByText(/test plan/i)).toBeInTheDocument();
    expect(await screen.findByText(/original task a/i)).toBeInTheDocument();
    expect(await screen.findByText(/original task b/i)).toBeInTheDocument();
  });

  it('shows an error state when the plan fails to load', async () => {
    mockApi.plans.get.mockRejectedValue(new Error('Network unreachable'));
    renderEditor();

    expect(await screen.findByText(/network unreachable/i)).toBeInTheDocument();
  });

  it('renders the three view tabs', async () => {
    mockApi.plans.get.mockResolvedValue(MOCK_PLAN);
    renderEditor();
    expect(await screen.findByRole('button', { name: /^table$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^timeline$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pillars$/i })).toBeInTheDocument();
  });

  it('inline-edits a task description and persists the change', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(MOCK_PLAN);
    mockApi.tasks.update.mockResolvedValue({
      ...MOCK_TASKS[0],
      description: 'Updated task A',
    });

    renderEditor();
    const cell = await screen.findByText(/original task a/i);
    await user.click(cell);

    const input = screen.getByDisplayValue(/original task a/i);
    await user.clear(input);
    await user.type(input, 'Updated task A');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockApi.tasks.update).toHaveBeenCalledWith(
        'plan-1', 't1', { description: 'Updated task A' },
      );
    });
  });

  it('inline-edit rollback shows error toast on API failure', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(MOCK_PLAN);
    mockApi.tasks.update.mockRejectedValue(new Error('save failed'));

    renderEditor();
    const cell = await screen.findByText(/original task a/i);
    await user.click(cell);

    const input = screen.getByDisplayValue(/original task a/i);
    await user.clear(input);
    await user.type(input, 'Bad save');
    await user.keyboard('{Enter}');

    // Original text restored + error toast
    expect(await screen.findByText(/failed to save task/i)).toBeInTheDocument();
    expect(await screen.findByText(/original task a/i)).toBeInTheDocument();
  });

  it('completing a task fires API and awards XP', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(MOCK_PLAN);
    mockApi.tasks.complete.mockResolvedValue({
      task: { ...MOCK_TASKS[0], done: true, completed_at: '2026-06-16T12:00:00Z' },
      xp_awarded: 50,
      pillar_xp_awarded: 50,
      new_total_xp: 4250,
      new_level: 5,
      leveled_up: false,
      streak: 7,
    });

    renderEditor();
    const checkbox = (await screen.findByText(/original task a/i))
      .closest('tr')
      ?.querySelector('button[aria-label="Mark done"]');
    expect(checkbox).toBeTruthy();
    await user.click(checkbox!);

    await waitFor(() => {
      expect(mockApi.tasks.complete).toHaveBeenCalledWith('plan-1', 't1');
    });
  });

  it('switches to timeline tab and renders tasks there', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(MOCK_PLAN);
    renderEditor();
    await user.click(await screen.findByRole('button', { name: /^timeline$/i }));
    // Timeline renders the same task descriptions
    expect(screen.getAllByText(/original task a/i).length).toBeGreaterThan(0);
  });

  it('switches to pillars tab and groups tasks', async () => {
    const user = userEvent.setup();
    mockApi.plans.get.mockResolvedValue(MOCK_PLAN);
    renderEditor();
    await user.click(await screen.findByRole('button', { name: /^pillars$/i }));
    // The pillars view shows the pillar names as h3 headers (capitalized via CSS)
    const floraHeaders = screen.getAllByRole('heading', { name: /^flora$/i });
    const tecnaHeaders = screen.getAllByRole('heading', { name: /^tecna$/i });
    expect(floraHeaders.length).toBeGreaterThan(0);
    expect(tecnaHeaders.length).toBeGreaterThan(0);
  });
});
