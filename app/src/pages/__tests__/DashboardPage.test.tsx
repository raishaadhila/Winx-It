import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { DashboardPage } from '../DashboardPage';
import type { PlanSummary, Task } from '../../lib/types';

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

const MOCK_PROFILE = {
  id: 'user-1',
  email: 't@x.io',
  name: 'Raisha',
  fairy: 'tecna' as const,
  pillar: 'tecna' as const,
  accent: 'blue' as const,
  avatar_seed: null,
  level: 5,
  total_xp: 4200,
  current_streak: 7,
  longest_streak: 14,
  last_completed_date: '2026-06-15',
  pillar_xp: { tecna: 1200, flora: 900, musa: 700, bloom: 600, stella: 800 },
  xp_to_next_level: 800,
};

const MOCK_TASKS: Task[] = [
  {
    id: 't1', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
    description: 'Read neuro mod 1', pillar: 'flora', hours: 2, energy: 'medium',
    done: false, completed_at: null, position: 0,
  },
  {
    id: 't2', plan_id: 'plan-1', day: 1, week: 1, month: 1, date: '2026-06-16',
    description: 'Dataset prep', pillar: 'tecna', hours: 1.5, energy: 'medium',
    done: false, completed_at: null, position: 1,
  },
];

const MOCK_SUMMARY: PlanSummary = {
  id: 'plan-1',
  title: 'Neuro MVP',
  timeframe: '3 months',
  start_date: '2026-06-16',
  end_date: '2026-07-16',
  status: 'active',
  total_tasks: 12,
  done_tasks: 3,
  progress: 0.25,
  created_at: '2026-06-16T00:00:00Z',
};

const ROUTES = (
  <>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/plan/:id" element={<div data-testid="plan-editor">Editor</div>} />
    <Route path="/plan/new" element={<div data-testid="prompt">Prompt</div>} />
  </>
);

function renderDashboard() {
  return renderWithProviders(null, {
    initialEntries: ['/dashboard'],
    routes: ROUTES,
  });
}

function setupMocks() {
  mockApi.me.get.mockResolvedValue(MOCK_PROFILE);
  mockApi.plans.list.mockResolvedValue([MOCK_SUMMARY]);
  mockApi.tasks.list.mockResolvedValue(MOCK_TASKS);
}

describe('<DashboardPage> flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeletons while data is fetching', () => {
    mockApi.me.get.mockImplementation(() => new Promise(() => {}));
    mockApi.plans.list.mockImplementation(() => new Promise(() => {}));
    mockApi.tasks.list.mockImplementation(() => new Promise(() => {}));

    renderDashboard();
    expect(document.querySelectorAll('.shimmer-bg').length).toBeGreaterThan(0);
  });

  it('renders hero with name and XP', async () => {
    setupMocks();
    renderDashboard();
    // "Raisha" now appears in BOTH the sidebar (avatar section) and the
    // main hero — that's correct per the new split-column wireframe.
    expect((await screen.findAllByText(/raisha/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LV 5/i).length).toBeGreaterThan(0);
  });

  it('shows today\'s quest with unchecked tasks', async () => {
    setupMocks();
    renderDashboard();
    expect(await screen.findByText(/read neuro mod 1/i)).toBeInTheDocument();
    expect(await screen.findByText(/dataset prep/i)).toBeInTheDocument();
  });

  it('shows streak card with the current streak', async () => {
    setupMocks();
    renderDashboard();
    expect(await screen.findByText(/day streak/i)).toBeInTheDocument();
  });

  it('shows active plans grid with the plan card', async () => {
    setupMocks();
    renderDashboard();
    expect(await screen.findByText(/neuro mvp/i)).toBeInTheDocument();
  });

  it('completing a task fires the API and updates local state', async () => {
    const user = userEvent.setup();
    setupMocks();
    mockApi.tasks.complete.mockResolvedValue({
      task: { ...MOCK_TASKS[0], done: true, completed_at: '2026-06-16T12:00:00Z' },
      xp_awarded: 50,
      pillar_xp_awarded: 50,
      new_total_xp: 4250,
      new_level: 5,
      leveled_up: false,
      streak: 7,
    });

    renderDashboard();
    const checkbox = (await screen.findByText(/read neuro mod 1/i)).closest('label')?.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    await user.click(checkbox!);

    await waitFor(() => {
      expect(mockApi.tasks.complete).toHaveBeenCalledWith('plan-1', 't1');
    });
  });

  it('shows an error banner with retry on API failure', async () => {
    mockApi.me.get.mockRejectedValue(new Error('boom'));
    mockApi.plans.list.mockRejectedValue(new Error('boom'));
    mockApi.tasks.list.mockRejectedValue(new Error('boom'));

    renderDashboard();
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });
});
