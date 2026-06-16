import { describe, expect, it } from 'vitest';
import { applyTaskComplete, type LocalStats } from '../localData';

function stats(overrides: Partial<LocalStats> = {}): LocalStats {
  return {
    total_xp: 0,
    level: 1,
    current_streak: 0,
    longest_streak: 0,
    last_completed_date: null,
    pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
    ...overrides,
  };
}

describe('local XP engine — parity with backend', () => {
  it('first task ever starts streak at 1, awards 50 + 200 bonus, total 250', () => {
    const r = applyTaskComplete(stats(), 'tecna', '2026-06-16');
    expect(r.xpAwarded).toBe(50);
    expect(r.streakBonus).toBe(200);
    expect(r.stats.total_xp).toBe(250);
    expect(r.stats.current_streak).toBe(1);
    expect(r.leveledUp).toBe(false);
  });

  it('consecutive day increments streak, bonus = 200 * new_streak', () => {
    const r = applyTaskComplete(
      stats({ current_streak: 3, last_completed_date: '2026-06-15' }),
      'tecna', '2026-06-16',
    );
    expect(r.stats.current_streak).toBe(4);
    expect(r.streakBonus).toBe(800);
    expect(r.stats.total_xp).toBe(50 + 800);
  });

  it('same day does not increment streak, no bonus', () => {
    const r = applyTaskComplete(
      stats({ current_streak: 3, total_xp: 100, last_completed_date: '2026-06-16' }),
      'tecna', '2026-06-16',
    );
    expect(r.stats.current_streak).toBe(3);
    expect(r.streakBonus).toBe(0);
    expect(r.stats.total_xp).toBe(150);
  });

  it('gap of > 1 day resets streak to 1 but preserves longest', () => {
    const r = applyTaskComplete(
      stats({
        current_streak: 10, longest_streak: 14,
        last_completed_date: '2026-06-10',
      }),
      'tecna', '2026-06-16',
    );
    expect(r.stats.current_streak).toBe(1);
    expect(r.stats.longest_streak).toBe(14);
  });

  it('pillar XP increments only for the task pillar (other pillars untouched)', () => {
    const r = applyTaskComplete(
      stats({ pillar_xp: { tecna: 100, flora: 200, musa: 0, bloom: 0, stella: 0 } }),
      'flora', '2026-06-16',
    );
    expect(r.stats.pillar_xp.flora).toBe(250);  // 200 + 50
    expect(r.stats.pillar_xp.tecna).toBe(100);  // unchanged
    expect(r.stats.pillar_xp.musa).toBe(0);
    expect(r.stats.pillar_xp.bloom).toBe(0);
    expect(r.stats.pillar_xp.stella).toBe(0);
  });

  it('level up detected when total crosses 1000', () => {
    const r = applyTaskComplete(
      stats({
        total_xp: 950, current_streak: 1, last_completed_date: '2026-06-15',
      }),
      'tecna', '2026-06-16',
    );
    // 950 + 50 + 400 (streak 2) = 1400 → level 2
    expect(r.stats.level).toBe(2);
    expect(r.stats.total_xp).toBe(1400);
    expect(r.leveledUp).toBe(true);
  });

  it('does not set leveled_up when staying in same level', () => {
    const r = applyTaskComplete(
      stats({ total_xp: 500, current_streak: 3, last_completed_date: '2026-06-16' }),
      'tecna', '2026-06-16',
    );
    expect(r.stats.level).toBe(1);
    expect(r.leveledUp).toBe(false);
  });

  it('records last_completed_date as the given today', () => {
    const r = applyTaskComplete(stats(), 'tecna', '2026-06-16');
    expect(r.stats.last_completed_date).toBe('2026-06-16');
  });

  it('longest_streak is updated to new_streak when new is bigger', () => {
    const r = applyTaskComplete(
      stats({ longest_streak: 2, current_streak: 4, last_completed_date: '2026-06-15' }),
      'tecna', '2026-06-16',
    );
    expect(r.stats.longest_streak).toBe(5);
  });
});
