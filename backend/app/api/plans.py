"""Plan generation + CRUD endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import AuthUser, get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.models import (
    GeneratedPlan,
    PlanCreate,
    PlanGenerateRequest,
    PlanOut,
    PlanSummary,
    PlanUpdate,
    TaskOut,
    TaskSpec,
)
from app.services.ai_planner import generate_plan

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.post("/generate", response_model=GeneratedPlan)
def generate(
    body: PlanGenerateRequest,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    return generate_plan(body)


@router.post("", response_model=PlanOut, status_code=201)
def create_plan(
    body: PlanCreate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")

    plan_row = admin.table("plans").insert({
        "user_id": user.id,
        "title": body.title,
        "goal_text": body.goal_text,
        "timeframe": body.timeframe,
        "start_date": body.start_date.isoformat(),
        "end_date": body.end_date.isoformat(),
        "status": "active",
    }).execute().data[0]

    task_rows = [
        {
            "plan_id": plan_row["id"],
            "user_id": user.id,
            "day": t.day,
            "week": t.week,
            "month": t.month,
            "date": t.date.isoformat(),
            "description": t.description,
            "pillar": t.pillar,
            "hours": t.hours,
            "energy": t.energy,
            "position": idx,
        }
        for idx, t in enumerate(body.tasks)
    ]
    if task_rows:
        admin.table("tasks").insert(task_rows).execute()

    tasks = admin.table("tasks").select("*").eq("plan_id", plan_row["id"]).order("position").execute().data
    return PlanOut(
        **plan_row,
        tasks=[TaskOut(**t) for t in tasks],
    )


@router.get("", response_model=list[PlanSummary])
def list_plans(user: Annotated[AuthUser, Depends(get_current_user)]):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")

    plans = (
        admin.table("plans")
        .select("*, tasks:tasks(done)")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    out: list[PlanSummary] = []
    for p in plans:
        tasks = p.pop("tasks") or []
        total = len(tasks)
        done = sum(1 for t in tasks if t.get("done"))
        out.append(PlanSummary(
            id=p["id"],
            title=p["title"],
            timeframe=p["timeframe"],
            start_date=p["start_date"],
            end_date=p["end_date"],
            status=p["status"],
            total_tasks=total,
            done_tasks=done,
            progress=(done / total) if total else 0.0,
            created_at=p["created_at"],
        ))
    return out


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(
    plan_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")

    plan = admin.table("plans").select("*").eq("id", plan_id).eq("user_id", user.id).single().execute().data
    if not plan:
        raise HTTPException(404, "Plan not found")
    tasks = (
        admin.table("tasks")
        .select("*")
        .eq("plan_id", plan_id)
        .order("position")
        .execute()
        .data
    )
    return PlanOut(**plan, tasks=[TaskOut(**t) for t in tasks])


@router.patch("/{plan_id}", response_model=PlanOut)
def update_plan(
    plan_id: str,
    body: PlanUpdate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")

    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if patch:
        admin.table("plans").update(patch).eq("id", plan_id).eq("user_id", user.id).execute()
    return get_plan(plan_id, user)


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")
    admin.table("plans").delete().eq("id", plan_id).eq("user_id", user.id).execute()
    return None
