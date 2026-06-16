import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { PromptPage } from '../../pages/PromptPage';

// Mock the api module so we control the response
vi.mock('../../lib/api', () => ({
  api: {
    plans: {
      generate: vi.fn(),
      create: vi.fn(),
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

const ROUTES = (
  <>
    <Route path="/plan/new" element={<PromptPage />} />
    <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
    <Route path="/plan/:id" element={<div data-testid="plan-editor">Editor</div>} />
  </>
);

function renderPrompt() {
  return renderWithProviders(null, {
    initialEntries: ['/plan/new'],
    routes: ROUTES,
  });
}

describe('<PromptPage> flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title and textarea', () => {
    renderPrompt();
    expect(screen.getByText(/what's your quest\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your goal/i)).toBeInTheDocument();
  });

  it('submit button is disabled when goal is empty', () => {
    renderPrompt();
    const btn = screen.getByRole('button', { name: /generate my plan/i });
    expect(btn).toBeDisabled();
  });

  it('enables submit after typing a goal', async () => {
    const user = userEvent.setup();
    renderPrompt();
    await user.type(screen.getByLabelText(/your goal/i), 'Build a SaaS MVP');
    const btn = screen.getByRole('button', { name: /generate my plan/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows the casting animation during generation', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                title: 'Test',
                start_date: '2026-06-16',
                end_date: '2026-07-16',
                tasks: [],
              }),
            500,
          ),
        ),
    );
    mockApi.plans.create.mockResolvedValue({
      id: 'plan-1',
      title: 'Test',
      goal_text: 'x',
      timeframe: '3 months',
      start_date: '2026-06-16',
      end_date: '2026-07-16',
      status: 'active',
      tasks: [],
      created_at: '2026-06-16T00:00:00Z',
      updated_at: '2026-06-16T00:00:00Z',
    });

    renderPrompt();
    await user.type(screen.getByLabelText(/your goal/i), 'Build something');
    await user.click(screen.getByRole('button', { name: /generate my plan/i }));

    expect(await screen.findByText(/analyzing goal/i)).toBeInTheDocument();
  });

  it('navigates to /dashboard after successful plan creation', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockResolvedValue({
      title: 'Test Plan',
      start_date: '2026-06-16',
      end_date: '2026-07-16',
      tasks: [
        {
          day: 1,
          week: 1,
          month: 1,
          date: '2026-06-16',
          description: 'Task 1',
          pillar: 'tecna',
          hours: 1.5,
          energy: 'medium',
        },
      ],
    });
    mockApi.plans.create.mockResolvedValue({
      id: 'plan-abc',
      title: 'Test Plan',
      goal_text: 'Build something',
      timeframe: '3 months',
      start_date: '2026-06-16',
      end_date: '2026-07-16',
      status: 'active',
      tasks: [],
      created_at: '2026-06-16T00:00:00Z',
      updated_at: '2026-06-16T00:00:00Z',
    });

    renderPrompt();
    await user.type(screen.getByLabelText(/your goal/i), 'Build something');
    await user.click(screen.getByRole('button', { name: /generate my plan/i }));

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('passes attachments to the API', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockResolvedValue({
      title: 'X', start_date: '2026-06-16', end_date: '2026-07-16', tasks: [],
    });
    mockApi.plans.create.mockResolvedValue({
      id: 'plan-abc', title: 'X', goal_text: 'g', timeframe: '3 months',
      start_date: '2026-06-16', end_date: '2026-07-16', status: 'active',
      tasks: [], created_at: '2026-06-16T00:00:00Z', updated_at: '2026-06-16T00:00:00Z',
    });

    renderPrompt();
    await user.type(screen.getByLabelText(/your goal/i), 'Build X');

    // Add a link via the UI
    await user.click(screen.getByRole('button', { name: /add link/i }));
    const linkInput = screen.getByPlaceholderText(/https:\/\/example\.com/);
    await user.type(linkInput, 'github.com/test');
    await user.keyboard('{Enter}');

    await user.click(screen.getByRole('button', { name: /generate my plan/i }));

    // The generate call should include the attachment
    await waitFor(() => {
      const call = mockApi.plans.generate.mock.calls[0][0];
      expect(call.attachments).toBeDefined();
      const atts = call.attachments as Array<{ kind: string; value: string }>;
      expect(atts[0].kind).toBe('link');
      expect(atts[0].value).toContain('github.com');
    });
  });

  it('auto-detects URLs pasted into the goal textarea', async () => {
    const user = userEvent.setup();
    renderPrompt();
    // Type a goal containing a URL — should be promoted to an attachment
    await user.type(
      screen.getByLabelText(/your goal/i),
      'Read this https://example.com/article please',
    );

    // The URL should appear as a chip
    expect(await screen.findByText('https://example.com/article')).toBeInTheDocument();
  }, 15000);

  it('shows error toast on API failure and re-enables submit', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockRejectedValue(new Error('Network down'));

    renderPrompt();
    await user.type(screen.getByLabelText(/your goal/i), 'Build something');
    await user.click(screen.getByRole('button', { name: /generate my plan/i }));

    // Toast appears with the friendly fallback message
    expect(await screen.findByText(/failed to generate plan/i)).toBeInTheDocument();
    // The form is back to the input state (button is re-enabled)
    expect(screen.getByRole('button', { name: /generate my plan/i })).not.toBeDisabled();
  });

  it('warns the user when the server returned a fallback stub (no LLM key)', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockResolvedValue({
      title: 'Generic Plan',
      start_date: '2026-06-16',
      end_date: '2026-09-13',
      tasks: [
        {
          day: 1, week: 1, month: 1, date: '2026-06-16',
          description: 'Do a thing', pillar: 'tecna', hours: 1, energy: 'medium',
        },
      ],
      fallback_stub: true,
    });
    mockApi.plans.create.mockResolvedValue({
      id: 'plan-x', title: 'Generic Plan', goal_text: 'g', timeframe: '3 months',
      start_date: '2026-06-16', end_date: '2026-09-13', status: 'active',
      tasks: [], created_at: '2026-06-16T00:00:00Z', updated_at: '2026-06-16T00:00:00Z',
    });

    renderPrompt();
    await user.type(screen.getByLabelText(/your goal/i), 'Build something');
    await user.click(screen.getByRole('button', { name: /generate my plan/i }));

    expect(
      await screen.findByText(/generic stub|NVIDIA_API_KEY/i),
    ).toBeInTheDocument();
  });

  it('sends goal + timeframe + pillars + attachments to the API (full personalization payload)', async () => {
    const user = userEvent.setup();
    mockApi.plans.generate.mockResolvedValue({
      title: 'X', start_date: '2026-06-16', end_date: '2026-09-13', tasks: [],
    });
    mockApi.plans.create.mockResolvedValue({
      id: 'plan-abc', title: 'X', goal_text: 'g', timeframe: '3 months',
      start_date: '2026-06-16', end_date: '2026-09-13', status: 'active',
      tasks: [], created_at: '2026-06-16T00:00:00Z', updated_at: '2026-06-16T00:00:00Z',
    });

    renderPrompt();

    // Goal
    await user.type(
      screen.getByLabelText(/your goal/i),
      'Train for a half-marathon in 12 weeks while keeping my day job',
    );

    // Timeframe: click "6 months"
    await user.click(screen.getByRole('button', { name: /6 months/i }));

    // Energy: click "physical"
    await user.click(screen.getByRole('button', { name: /physical/i }));

    // Pillars: ensure stella + flora are on, others off.
    // Default is tecna+flora — toggle tecna off, add stella.
    // Active chip prefix is "✓", inactive is "+"; match the label itself.
    await user.click(screen.getByRole('button', { name: /tecna/i }));
    await user.click(screen.getByRole('button', { name: /stella/i }));

    // Attachment: add a link
    await user.click(screen.getByRole('button', { name: /add link/i }));
    const linkInput = screen.getByPlaceholderText(/https:\/\/example\.com/);
    await user.type(linkInput, 'docs.halfmarathon.training/plan');
    await user.keyboard('{Enter}');

    // Submit
    await user.click(screen.getByRole('button', { name: /generate my plan/i }));

    // Assert the payload that hit the AI
    await waitFor(() => expect(mockApi.plans.generate).toHaveBeenCalled());
    const payload = mockApi.plans.generate.mock.calls[0][0];

    // 1. Goal text is sent verbatim
    expect(payload.goal).toBe(
      'Train for a half-marathon in 12 weeks while keeping my day job',
    );
    // 2. Timeframe is the chosen one
    expect(payload.timeframe).toBe('6 months');
    // 3. Energy focus is the chosen one
    expect(payload.energy_focus).toBe('physical');
    // 4. Pillar set matches what the user toggled
    expect(new Set(payload.pillars)).toEqual(new Set(['flora', 'stella']));
    // 5. Attachment is forwarded
    expect(payload.attachments).toBeDefined();
    expect(payload.attachments![0].kind).toBe('link');
    expect(payload.attachments![0].value).toBe('https://docs.halfmarathon.training/plan');
  }, 15000);
});
