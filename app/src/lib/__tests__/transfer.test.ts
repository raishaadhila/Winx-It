import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: 'user-abc' } } }),
    },
    from: () => ({
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

const localMock = {
  listLocalPlans: vi.fn(),
  deleteLocalPlan: vi.fn(),
  getLocalProfile: vi.fn(),
  saveLocalProfile: vi.fn(),
};

vi.mock('../localData', () => localMock);

const apiMock = {
  plans: {
    create: vi.fn(),
  },
};

vi.mock('../api', () => ({ api: apiMock }));

const localStorageState: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => localStorageState[k] ?? null,
  setItem: (k: string, v: string) => { localStorageState[k] = v; },
  removeItem: (k: string) => { delete localStorageState[k]; },
  clear: () => { for (const k in localStorageState) delete localStorageState[k]; },
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('transferLocalPlansToCloud', () => {
  beforeEach(() => {
    Object.keys(localStorageState).forEach((k) => delete localStorageState[k]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('does nothing when there are no local plans', async () => {
    localMock.listLocalPlans.mockReturnValue([]);
    const { transferLocalPlansToCloud } = await import('../transfer');
    const out = await transferLocalPlansToCloud();
    expect(out.transferred).toBe(0);
    expect(out.failed).toBe(0);
    expect(apiMock.plans.create).not.toHaveBeenCalled();
  });

  it('migrates each local plan to the backend', async () => {
    localMock.listLocalPlans.mockReturnValue([
      {
        id: 'p1', title: 'A', goal_text: 'g', timeframe: '1 month',
        start_date: '2026-06-16', end_date: '2026-07-15',
        tasks: [{
          id: 't1', plan_id: 'p1', day: 1, week: 1, month: 1,
          date: '2026-06-16', description: 'd', pillar: 'tecna', hours: 0.5, energy: 'low', done: false,
        }],
      },
    ]);
    apiMock.plans.create.mockResolvedValue({ id: 'cloud-1' });

    const { transferLocalPlansToCloud } = await import('../transfer');
    const out = await transferLocalPlansToCloud();

    expect(out.transferred).toBe(1);
    expect(out.failed).toBe(0);
    expect(apiMock.plans.create).toHaveBeenCalledTimes(1);
    expect(localMock.deleteLocalPlan).toHaveBeenCalledWith('p1');
  });

  it('is idempotent — runs once, then the flag prevents it', async () => {
    localMock.listLocalPlans.mockReturnValue([
      { id: 'p1', title: 'A', goal_text: 'g', timeframe: '1 month',
        start_date: '2026-06-16', end_date: '2026-07-15', tasks: [] },
    ]);
    apiMock.plans.create.mockResolvedValue({ id: 'cloud-1' });

    const { transferLocalPlansToCloud } = await import('../transfer');
    await transferLocalPlansToCloud();
    // Second call should be a no-op
    localMock.listLocalPlans.mockReturnValue([
      { id: 'p2', title: 'B', goal_text: 'h', timeframe: '1 month',
        start_date: '2026-06-16', end_date: '2026-07-15', tasks: [] },
    ]);
    const out2 = await transferLocalPlansToCloud();
    expect(out2.transferred).toBe(0);
    expect(apiMock.plans.create).toHaveBeenCalledTimes(1); // still 1
  });

  it('records failures without aborting the batch', async () => {
    localMock.listLocalPlans.mockReturnValue([
      { id: 'p1', title: 'A', goal_text: 'g', timeframe: '1 month',
        start_date: '2026-06-16', end_date: '2026-07-15', tasks: [] },
      { id: 'p2', title: 'B', goal_text: 'h', timeframe: '1 month',
        start_date: '2026-06-16', end_date: '2026-07-15', tasks: [] },
    ]);
    apiMock.plans.create
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 'cloud-2' });

    const { transferLocalPlansToCloud } = await import('../transfer');
    const out = await transferLocalPlansToCloud();
    expect(out.transferred).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.errors[0]).toContain('network down');
  });
});
