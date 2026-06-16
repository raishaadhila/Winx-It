"""Pydantic schemas for API request/response models."""
from __future__ import annotations

from datetime import date as Date
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# `date` is a field name on TaskSpec / TaskOut, so we use `Date` as the type
# alias to avoid name collisions inside model class scopes.
date = Date

Pillar = Literal["tecna", "flora", "musa", "bloom", "stella"]
Fairy = Literal["bloom", "stella", "flora", "musa", "tecna", "layla"]
Accent = Literal["pink", "blue", "lime", "purple", "yellow"]
Energy = Literal["low", "medium", "high"]
PlanStatus = Literal["active", "paused", "completed", "archived"]
AttachmentKind = Literal["image", "file", "link"]


class Attachment(BaseModel):
    id: str
    kind: AttachmentKind
    name: str
    value: str
    size: int | None = None
    mime: str | None = None


# --- Profile / Me -----------------------------------------------------------
class ProfileOut(BaseModel):
    id: UUID
    email: str
    name: str
    fairy: Fairy
    pillar: Pillar
    accent: Accent
    avatar_seed: str | None = None
    avatar_data_url: str | None = None
    goal_text: str = ""
    level: int
    total_xp: int
    current_streak: int
    longest_streak: int
    last_completed_date: Date | None = None
    pillar_xp: dict[Pillar, int]
    xp_to_next_level: int


class AvatarUpdate(BaseModel):
    fairy: Fairy | None = None
    pillar: Pillar | None = None
    accent: Accent | None = None
    name: str | None = None
    avatar_seed: str | None = None


class ProfileUpdate(BaseModel):
    """Editable profile fields. All optional — only provided fields are written."""
    name: str | None = Field(None, min_length=1, max_length=80)
    fairy: Fairy | None = None
    pillar: Pillar | None = None
    accent: Accent | None = None
    goal_text: str | None = Field(None, max_length=2000)
    avatar_data_url: str | None = Field(None, max_length=2_000_000)


# --- Plans ------------------------------------------------------------------
class PlanGenerateRequest(BaseModel):
    goal: str = Field(..., min_length=8, max_length=2000)
    timeframe: Literal["1 month", "3 months", "6 months", "custom"] = "3 months"
    custom_days: int | None = Field(None, ge=1, le=365)
    energy_focus: Literal["deep", "physical", "creative", "balanced"] = "balanced"
    pillars: list[Pillar] = Field(
        default_factory=lambda: ["tecna", "flora", "musa", "bloom", "stella"],
        min_length=1,
    )
    attachments: list[Attachment] | None = None
    custom_prompt: str | None = Field(None, max_length=4000)


class TaskSpec(BaseModel):
    day: int = Field(..., ge=1)
    week: int = Field(..., ge=1)
    month: int = Field(..., ge=1)
    date: Date
    description: str
    pillar: Pillar
    hours: float = Field(1.0, ge=0.25, le=12)
    energy: Energy = "medium"


class GeneratedPlan(BaseModel):
    title: str
    start_date: Date
    end_date: Date
    tasks: list[TaskSpec]


class PlanCreate(BaseModel):
    title: str
    goal_text: str
    timeframe: str
    start_date: Date
    end_date: Date
    tasks: list[TaskSpec]


class PlanOut(BaseModel):
    id: UUID
    title: str
    goal_text: str
    timeframe: str
    start_date: Date
    end_date: Date
    status: PlanStatus
    tasks: list[TaskOut]
    created_at: datetime
    updated_at: datetime


class PlanSummary(BaseModel):
    id: UUID
    title: str
    timeframe: str
    start_date: Date
    end_date: Date
    status: PlanStatus
    total_tasks: int
    done_tasks: int
    progress: float
    created_at: datetime


class PlanUpdate(BaseModel):
    title: str | None = None
    status: PlanStatus | None = None


# --- Tasks ------------------------------------------------------------------
class TaskCreate(BaseModel):
    day: int = Field(..., ge=1)
    week: int = Field(..., ge=1)
    month: int = Field(..., ge=1)
    date: Date
    description: str
    pillar: Pillar
    hours: float = Field(1.0, ge=0.25, le=12)
    energy: Energy = "medium"
    position: int = 0


class TaskUpdate(BaseModel):
    description: str | None = None
    pillar: Pillar | None = None
    hours: float | None = Field(None, ge=0.25, le=12)
    energy: Energy | None = None
    day: int | None = None
    week: int | None = None
    month: int | None = None
    date: Date | None = None
    position: int | None = None


class TaskOut(BaseModel):
    id: UUID
    plan_id: UUID
    day: int
    week: int
    month: int
    date: Date
    description: str
    pillar: Pillar
    hours: float
    energy: Energy
    done: bool
    completed_at: datetime | None
    position: int


class TaskCompleteResponse(BaseModel):
    task: TaskOut
    xp_awarded: int
    pillar_xp_awarded: int
    new_total_xp: int
    new_level: int
    leveled_up: bool
    streak: int


# --- XP / Streak ------------------------------------------------------------
class XpEventOut(BaseModel):
    id: UUID
    source: str
    amount: int
    pillar: Pillar | None
    ref_id: UUID | None
    created_at: datetime
