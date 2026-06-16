import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanGenerateRequest } from '../types';

const REQ: PlanGenerateRequest = {
  goal: 'Become conversationally fluent in Japanese in 1 month',
  timeframe: '1 month',
  energy_focus: 'deep',
  pillars: ['musa', 'bloom'],
};

const FAKE_PLAN = {
  title: 'JLPT N5 Sprint',
  start_date: '2026-06-16',
  end_date: '2026-07-15',
  tasks: [
    {
      day: 1, week: 1, month: 1, date: '2026-06-16',
      description: 'Install Anki', pillar: 'tecna', hours: 0.5, energy: 'low',
    },
  ],
};

let mockAuthed = false;

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: mockAuthed ? { access_token: 'jwt-xyz' } : null },
        }),
    },
  },
}));

describe('api.plans.generate routing', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(FAKE_PLAN), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    mockAuthed = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('guests hit /api/anon/plans/generate (no auth header)', async () => {
    const { api } = await import('../api');
    const out = await api.plans.generate(REQ);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/anon/plans/generate');
    expect(init.method).toBe('POST');
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(out.title).toBe('JLPT N5 Sprint');
  });

  it('authed users hit /api/plans/generate with the JWT', async () => {
    mockAuthed = true;
    const { api } = await import('../api');
    await api.plans.generate(REQ);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/plans/generate');
    expect(init.headers.Authorization).toBe('Bearer jwt-xyz');
  });

  it('surfaces 429 from the anon endpoint as a clear ApiError', async () => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Rate limit exceeded: 5 plans per 10 minutes' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { api, ApiError } = await import('../api');
    try {
      await api.plans.generate(REQ);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toMatchObject({ status: 429 });
    }
  });

  it('surfaces 503 (LLM not configured) as a clear ApiError', async () => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'LLM not available: NVIDIA_API_KEY is missing' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { api, ApiError } = await import('../api');
    try {
      await api.plans.generate(REQ);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toMatchObject({ status: 503 });
    }
  });
});
