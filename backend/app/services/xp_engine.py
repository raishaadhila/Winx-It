"""XP and streak engine. Awarded automatically on task completion.

Public surface:
  • `level_for(total_xp)`         — pure math
  • `xp_to_next(total_xp)`        — pure math
  • `compute_task_completion(...)` — pure math, no DB. Returns the state delta.
  • `award_task_completion(...)`  — DB writer. Computes, then persists.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Protocol

from supabase import Client

from app.schemas.models import Pillar

XP_PER_TASK = 50
STREAK_BONUS_PER_DAY = 200
XP_PER_LEVEL = 1000


# ---------- Pure math ----------

def level_for(total_xp: int) -> int:
    return max(1, total_xp // XP_PER_LEVEL + 1)


def xp_to_next(total_xp: int) -> int:
    return XP_PER_LEVEL - (total_xp % XP_PER_LEVEL)


@dataclass(frozen=True)
class ProfileSnapshot:
    total_xp: int
    current_streak: int
    longest_streak: int
    last_completed_date: str | None  # ISO date string


@dataclass(frozen=True)
class CompletionResult:
    new_total_xp: int
    new_level: int
    leveled_up: bool
    new_streak: int
    new_longest_streak: int
    xp_awarded: int
    streak_bonus: int
    pillar_xp_awarded: int
    pillar_xp_before: int
    pillar_xp_after: int


def compute_task_completion(
    *,
    snapshot: ProfileSnapshot,
    pillar: Pillar,
    pillar_xp_current: int,
    now: date,
) -> CompletionResult:
    """Pure: figure out the new state for completing a task on `now`."""
    today = now.isoformat()
    last = snapshot.last_completed_date

    # streak logic
    new_streak = snapshot.current_streak
    bonus = 0
    if last != today:
        if last and (now - date.fromisoformat(last)).days == 1:
            new_streak = snapshot.current_streak + 1
        else:
            new_streak = 1
        bonus = STREAK_BONUS_PER_DAY * new_streak

    new_longest = max(snapshot.longest_streak, new_streak)
    new_total = snapshot.total_xp + XP_PER_TASK + bonus
    new_level = level_for(new_total)

    return CompletionResult(
        new_total_xp=new_total,
        new_level=new_level,
        leveled_up=new_level > level_for(snapshot.total_xp),
        new_streak=new_streak,
        new_longest_streak=new_longest,
        xp_awarded=XP_PER_TASK,
        streak_bonus=bonus,
        pillar_xp_awarded=XP_PER_TASK,
        pillar_xp_before=pillar_xp_current,
        pillar_xp_after=pillar_xp_current + XP_PER_TASK,
    )


# ---------- DB layer ----------

class _DbLike(Protocol):
    def table(self, name: str): ...
    def rpc(self, name: str, params: dict): ...


def award_task_completion(
    db: _DbLike,
    *,
    user_id: str,
    task_id: str,
    pillar: Pillar,
    now: date | None = None,
) -> dict:
    """Compute the result, then write it back. `now` is overridable for tests."""
    effective_now = now or date.today()

    profile = (
        db.table("profiles")
        .select("total_xp, current_streak, longest_streak, last_completed_date")
        .eq("id", user_id)
        .single()
        .execute()
    ).data or {}

    snapshot = ProfileSnapshot(
        total_xp=int(profile.get("total_xp") or 0),
        current_streak=int(profile.get("current_streak") or 0),
        longest_streak=int(profile.get("longest_streak") or 0),
        last_completed_date=profile.get("last_completed_date"),
    )

    px = (
        db.table("pillar_xp")
        .select(pillar)
        .eq("user_id", user_id)
        .single()
        .execute()
    ).data or {}
    pillar_xp_current = int(px.get(pillar) or 0)

    result = compute_task_completion(
        snapshot=snapshot,
        pillar=pillar,
        pillar_xp_current=pillar_xp_current,
        now=effective_now,
    )

    # 1) XP event audit
    db.table("xp_events").insert({
        "user_id": user_id,
        "source": "task_complete",
        "amount": result.xp_awarded,
        "pillar": pillar,
        "ref_id": task_id,
    }).execute()
    if result.streak_bonus:
        db.table("xp_events").insert({
            "user_id": user_id,
            "source": "streak_bonus",
            "amount": result.streak_bonus,
            "pillar": None,
            "ref_id": None,
        }).execute()

    # 2) Pillar XP delta
    db.table("pillar_xp").update({pillar: result.pillar_xp_after}).eq("user_id", user_id).execute()

    # 3) Profile totals
    db.table("profiles").update({
        "total_xp": result.new_total_xp,
        "level": result.new_level,
        "current_streak": result.new_streak,
        "longest_streak": result.new_longest_streak,
        "last_completed_date": effective_now.isoformat(),
    }).eq("id", user_id).execute()

    return {
        "xp_awarded": result.xp_awarded,
        "pillar_xp_awarded": result.pillar_xp_awarded,
        "streak_bonus": result.streak_bonus,
        "new_total_xp": result.new_total_xp,
        "new_level": result.new_level,
        "leveled_up": result.leveled_up,
        "streak": result.new_streak,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
