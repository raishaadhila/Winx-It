import { describe, expect, it } from 'vitest';
import { local } from '../localData';
import type { PlanGenerateRequest } from '../types';

function req(overrides: Partial<PlanGenerateRequest> = {}): PlanGenerateRequest {
  return {
    goal: 'Build a SaaS MVP in 3 months',
    timeframe: '3 months',
    energy_focus: 'balanced',
    pillars: ['tecna', 'bloom', 'stella'],
    ...overrides,
  };
}

describe('local AI planner (stub)', () => {
  it('returns a GeneratedPlan', async () => {
    const plan = await local.plans.generate(req());
    expect(plan.title).toBeTruthy();
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it('title-cases the first sentence of the goal', async () => {
    const plan = await local.plans.generate(req({ goal: 'learn rust and ship a cli.' }));
    expect(plan.title).toBe('Learn Rust And Ship A Cli');
  });

  it('strips trailing period and capitalizes each word', async () => {
    const plan = await local.plans.generate(req({ goal: 'launch a podcast about productivity.' }));
    expect(plan.title).toBe('Launch A Podcast About Productivity');
  });

  it('cycles tasks through the chosen pillars', async () => {
    const plan = await local.plans.generate(req({ pillars: ['tecna', 'flora'] }));
    const seen = new Set(plan.tasks.map((t) => t.pillar));
    expect(seen).toEqual(new Set(['tecna', 'flora']));
  });

  it('1 month produces 21 stub tasks (capped at 3 weeks)', async () => {
    const plan = await local.plans.generate(req({ timeframe: '1 month' }));
    expect(plan.tasks).toHaveLength(21);
  });

  it('3 months produces 21 stub tasks (capped at 3 weeks)', async () => {
    const plan = await local.plans.generate(req({ timeframe: '3 months' }));
    expect(plan.tasks).toHaveLength(21);
  });

  it('6 months still produces 21 stub tasks (capped at 3 weeks)', async () => {
    const plan = await local.plans.generate(req({ timeframe: '6 months' }));
    expect(plan.tasks).toHaveLength(21);
  });

  it('every task has a valid date string (YYYY-MM-DD)', async () => {
    const plan = await local.plans.generate(req());
    for (const t of plan.tasks) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('start_date and end_date are YYYY-MM-DD', async () => {
    const plan = await local.plans.generate(req());
    expect(plan.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('task day/week/month numbers are consistent', async () => {
    const plan = await local.plans.generate(req());
    for (const t of plan.tasks) {
      expect(t.week).toBe(Math.ceil(t.day / 7));
      expect(t.month).toBe(Math.ceil(t.day / 30));
    }
  });

  it('hours are always in the 0.5-2.0 range', async () => {
    const plan = await local.plans.generate(req());
    for (const t of plan.tasks) {
      expect(t.hours).toBeGreaterThanOrEqual(0.5);
      expect(t.hours).toBeLessThanOrEqual(2.0);
    }
  });
});
