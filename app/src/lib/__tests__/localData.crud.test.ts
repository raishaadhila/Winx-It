import { describe, expect, it, beforeEach } from 'vitest';
import {
  listLocalPlans,
  saveLocalPlan,
  getLocalPlan,
  deleteLocalPlan,
  local,
} from '../localData';
import type { Plan } from '../types';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Test plan',
    goal_text: 'Goal',
    timeframe: '3 months',
    start_date: '2026-06-16',
    end_date: '2026-09-13',
    status: 'active',
    tasks: [
      {
        id: crypto.randomUUID(),
        plan_id: '',
        day: 1, week: 1, month: 1,
        date: '2026-06-16',
        description: 'Task A',
        pillar: 'tecna',
        hours: 1.5, energy: 'medium',
        done: false, completed_at: null, position: 0,
      },
      {
        id: crypto.randomUUID(),
        plan_id: '',
        day: 1, week: 1, month: 1,
        date: '2026-06-16',
        description: 'Task B',
        pillar: 'flora',
        hours: 1, energy: 'low',
        done: true, completed_at: now, position: 1,
      },
    ],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('plan CRUD', () => {
  it('starts with no plans', () => {
    expect(listLocalPlans()).toEqual([]);
  });

  it('saves a plan and reads it back', () => {
    const p = makePlan();
    saveLocalPlan(p);
    expect(getLocalPlan(p.id)?.title).toBe('Test plan');
  });

  it('returns null for unknown id', () => {
    expect(getLocalPlan('nope')).toBeNull();
  });

  it('overwrites an existing plan with the same id', () => {
    const p = makePlan({ title: 'Original' });
    saveLocalPlan(p);
    saveLocalPlan({ ...p, title: 'Updated' });
    expect(listLocalPlans()).toHaveLength(1);
    expect(getLocalPlan(p.id)?.title).toBe('Updated');
  });

  it('keeps most-recent first when adding new plans', () => {
    const a = makePlan({ title: 'A' });
    const b = makePlan({ title: 'B' });
    const c = makePlan({ title: 'C' });
    saveLocalPlan(a);
    saveLocalPlan(b);
    saveLocalPlan(c);
    expect(listLocalPlans().map((p) => p.title)).toEqual(['C', 'B', 'A']);
  });

  it('deletes a plan by id', () => {
    const p = makePlan();
    saveLocalPlan(p);
    deleteLocalPlan(p.id);
    expect(listLocalPlans()).toEqual([]);
  });

  it('delete is a no-op for unknown id', () => {
    const p = makePlan();
    saveLocalPlan(p);
    deleteLocalPlan('nope');
    expect(listLocalPlans()).toHaveLength(1);
  });
});

describe('local.plans.summary', () => {
  it('summarises a plan with progress', async () => {
    const p = makePlan();
    saveLocalPlan(p);
    const list = await local.plans.list();
    expect(list).toHaveLength(1);
    const sum = list[0];
    expect(sum.id).toBe(p.id);
    expect(sum.title).toBe('Test plan');
    expect(sum.total_tasks).toBe(2);
    expect(sum.done_tasks).toBe(1);
    expect(sum.progress).toBe(0.5);
  });

  it('returns empty list when no plans exist', async () => {
    expect(await local.plans.list()).toEqual([]);
  });

  it('progress is 0 when no tasks', async () => {
    const p = makePlan({ tasks: [] });
    saveLocalPlan(p);
    const sum = (await local.plans.list())[0];
    expect(sum.progress).toBe(0);
    expect(sum.total_tasks).toBe(0);
  });
});

describe('local.tasks.update', () => {
  it('updates task description and persists', async () => {
    const p = makePlan();
    saveLocalPlan(p);
    const task = p.tasks[0];
    const updated = await local.tasks.update(p.id, task.id, { description: 'New' });
    expect(updated.description).toBe('New');
    expect(getLocalPlan(p.id)?.tasks[0].description).toBe('New');
  });

  it('throws when plan does not exist', async () => {
    await expect(
      local.tasks.update('missing', 't1', { description: 'x' }),
    ).rejects.toThrow('Plan not found');
  });

  it('throws when task does not exist', async () => {
    const p = makePlan();
    saveLocalPlan(p);
    await expect(
      local.tasks.update(p.id, 'missing', { description: 'x' }),
    ).rejects.toThrow('Task not found');
  });
});

describe('local.tasks.complete', () => {
  it('marks task done, awards XP, is idempotent on second call', async () => {
    const p = makePlan();
    saveLocalPlan(p);
    const task = p.tasks[0];
    const r1 = await local.tasks.complete(p.id, task.id);
    expect(r1.task.done).toBe(true);
    expect(r1.xp_awarded).toBe(50);
    // 50 + 200 (streak 1 bonus) = 250
    expect(r1.new_total_xp).toBe(250);
    expect(r1.streak).toBe(1);

    // Second call: idempotent, no new XP
    const r2 = await local.tasks.complete(p.id, task.id);
    expect(r2.xp_awarded).toBe(0);
    expect(r2.new_total_xp).toBe(250);
  });

  it('throws when plan missing', async () => {
    await expect(local.tasks.complete('missing', 't1')).rejects.toThrow('Plan not found');
  });

  it('throws when task missing', async () => {
    const p = makePlan();
    saveLocalPlan(p);
    await expect(local.tasks.complete(p.id, 'missing')).rejects.toThrow('Task not found');
  });
});
