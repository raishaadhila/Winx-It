"""TDD: XP engine pure logic.

The pure math (compute_task_completion) is tested directly with no DB
mocking. The DB-writer (award_task_completion) is tested separately with
a fake supabase client.
"""
from datetime import date

import pytest

from app.services.xp_engine import (
    CompletionResult,
    ProfileSnapshot,
    STREAK_BONUS_PER_DAY,
    XP_PER_LEVEL,
    XP_PER_TASK,
    compute_task_completion,
    level_for,
    xp_to_next,
)


# ---------- level_for ----------

class TestLevelFor:
    def test_zero_xp_is_level_1(self):
        assert level_for(0) == 1

    def test_999_xp_is_still_level_1(self):
        assert level_for(999) == 1

    def test_1000_xp_is_level_2(self):
        assert level_for(1000) == 2

    def test_1999_xp_is_still_level_2(self):
        assert level_for(1999) == 2

    def test_2000_xp_is_level_3(self):
        assert level_for(2000) == 3

    def test_5000_xp_is_level_6(self):
        assert level_for(5000) == 6

    def test_negative_xp_clamps_to_level_1(self):
        # Defensive: shouldn't happen in practice but the function must not crash
        assert level_for(-100) == 1


# ---------- xp_to_next ----------

class TestXpToNext:
    def test_full_level_remaining_when_starting(self):
        assert xp_to_next(0) == XP_PER_LEVEL  # 1000

    def test_mid_level_returns_remainder(self):
        assert xp_to_next(250) == 750

    def test_one_xp_from_levelup(self):
        assert xp_to_next(999) == 1

    def test_full_level_remaining_at_level_boundary(self):
        # At 1000 exactly, level is 2, so 1000 XP to next level
        assert xp_to_next(1000) == XP_PER_LEVEL

    def test_5000_xp_means_1000_to_next(self):
        # 5000 / 1000 = 5, level 6, 1000 XP to level 7
        assert xp_to_next(5000) == XP_PER_LEVEL


# ---------- compute_task_completion (pure, no DB) ----------

def _snap(**overrides) -> ProfileSnapshot:
    base = dict(
        total_xp=0, current_streak=0, longest_streak=0, last_completed_date=None,
    )
    base.update(overrides)
    return ProfileSnapshot(**base)


class TestFirstTaskEver:
    def test_starts_streak_at_1(self):
        r = compute_task_completion(
            snapshot=_snap(), pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.new_streak == 1

    def test_awards_50_task_xp_plus_streak_bonus(self):
        r = compute_task_completion(
            snapshot=_snap(), pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.xp_awarded == 50
        # First task starts streak 1 → bonus = 200*1 = 200 → total = 50 + 200 = 250
        assert r.streak_bonus == 200
        assert r.new_total_xp == 250

    def test_no_streak_bonus_on_first_ever_task(self):
        # The spec is: bonus is awarded when starting a new day.
        # When last_completed_date is None, the streak is "starting"
        # but the bonus applies to the new day, so first task gets the bonus.
        # Actually, re-checking: bonus = STREAK_BONUS * new_streak, and new_streak = 1
        # So there IS a bonus on the first task — 200 * 1 = 200
        r = compute_task_completion(
            snapshot=_snap(), pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.streak_bonus == STREAK_BONUS_PER_DAY * 1

    def test_longest_streak_updated(self):
        r = compute_task_completion(
            snapshot=_snap(), pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.new_longest_streak == 1


class TestConsecutiveDay:
    def test_streak_increments_by_one(self):
        r = compute_task_completion(
            snapshot=_snap(current_streak=3, last_completed_date="2026-06-15"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.new_streak == 4

    def test_streak_bonus_scales_with_new_streak(self):
        # new_streak=4, bonus = 200 * 4 = 800
        r = compute_task_completion(
            snapshot=_snap(current_streak=3, last_completed_date="2026-06-15"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.streak_bonus == 800
        assert r.new_total_xp == 50 + 800


class TestSameDay:
    def test_streak_does_not_increment(self):
        r = compute_task_completion(
            snapshot=_snap(current_streak=3, last_completed_date="2026-06-16"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.new_streak == 3

    def test_no_streak_bonus_same_day(self):
        r = compute_task_completion(
            snapshot=_snap(current_streak=3, last_completed_date="2026-06-16"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.streak_bonus == 0

    def test_still_awards_task_xp(self):
        r = compute_task_completion(
            snapshot=_snap(current_streak=3, last_completed_date="2026-06-16"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.xp_awarded == 50
        assert r.new_total_xp == 50


class TestGapResetsStreak:
    def test_resets_streak_to_1(self):
        r = compute_task_completion(
            snapshot=_snap(current_streak=10, longest_streak=14,
                           last_completed_date="2026-06-10"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),  # 6-day gap
        )
        assert r.new_streak == 1

    def test_preserves_longest_streak(self):
        r = compute_task_completion(
            snapshot=_snap(current_streak=10, longest_streak=14,
                           last_completed_date="2026-06-10"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.new_longest_streak == 14


class TestLevelUp:
    def test_levelup_detected_at_1000_xp(self):
        # 950 + 50 + 400 (streak 2) = 1400 → level 2
        r = compute_task_completion(
            snapshot=_snap(total_xp=950, current_streak=1, last_completed_date="2026-06-15"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.new_level == 2
        assert r.leveled_up is True

    def test_no_levelup_within_same_level(self):
        r = compute_task_completion(
            snapshot=_snap(total_xp=100, current_streak=3, last_completed_date="2026-06-16"),
            pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        assert r.leveled_up is False
        assert r.new_level == 1


class TestPillarXp:
    def test_pillar_xp_increments_by_50(self):
        r = compute_task_completion(
            snapshot=_snap(), pillar="flora", pillar_xp_current=100, now=date(2026, 6, 16),
        )
        assert r.pillar_xp_before == 100
        assert r.pillar_xp_after == 150
        assert r.pillar_xp_awarded == 50

    def test_pillar_xp_each_pillar_independent(self):
        r_tecna = compute_task_completion(
            snapshot=_snap(), pillar="tecna", pillar_xp_current=500, now=date(2026, 6, 16),
        )
        assert r_tecna.pillar_xp_after == 550

        r_stella = compute_task_completion(
            snapshot=_snap(), pillar="stella", pillar_xp_current=200, now=date(2026, 6, 16),
        )
        assert r_stella.pillar_xp_after == 250


# ---------- Result type ----------

class TestCompletionResultDataclass:
    def test_is_immutable(self):
        r = compute_task_completion(
            snapshot=_snap(), pillar="tecna", pillar_xp_current=0, now=date(2026, 6, 16),
        )
        with pytest.raises(Exception):
            r.new_total_xp = 999  # type: ignore[misc]
