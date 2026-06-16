"""Task CRUD + completion endpoint (XP awarded automatically on complete)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import AuthUser, get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.models import (
    TaskCompleteResponse,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.services.xp_engine import award_task_completion

router = APIRouter(prefix="/api/plans/{plan_id}/tasks", tags=["tasks"])


def _ensure_plan_owner(admin, plan_id: str, user_id: str) -> None:
    plan = admin.table("plans").select("id").eq("id", plan_id).eq("user_id", user_id).single().execute().data
    if not plan:
        raise HTTPException(404, "Plan not found")


@router.get("", response_model=list[TaskOut])
def list_tasks(
    plan_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")
    _ensure_plan_owner(admin, plan_id, user.id)
    rows = admin.table("tasks").select("*").eq("plan_id", plan_id).order("position").execute().data
    return [TaskOut(**r) for r in rows]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    plan_id: str,
    body: TaskCreate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")
    _ensure_plan_owner(admin, plan_id, user.id)

    row = admin.table("tasks").insert({
        "plan_id": plan_id,
        "user_id": user.id,
        "day": body.day,
        "week": body.week,
        "month": body.month,
        "date": body.date.isoformat(),
        "description": body.description,
        "pillar": body.pillar,
        "hours": body.hours,
        "energy": body.energy,
        "position": body.position,
    }).execute().data[0]
    return TaskOut(**row)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    plan_id: str,
    task_id: str,
    body: TaskUpdate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")
    _ensure_plan_owner(admin, plan_id, user.id)

    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "date" in patch and patch["date"]:
        patch["date"] = patch["date"].isoformat()
    if patch:
        admin.table("tasks").update(patch).eq("id", task_id).eq("plan_id", plan_id).execute()
    row = admin.table("tasks").select("*").eq("id", task_id).single().execute().data
    return TaskOut(**row)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    plan_id: str,
    task_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")
    _ensure_plan_owner(admin, plan_id, user.id)
    admin.table("tasks").delete().eq("id", task_id).eq("plan_id", plan_id).execute()
    return None


@router.post("/{task_id}/complete", response_model=TaskCompleteResponse)
def complete_task(
    plan_id: str,
    task_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    """Mark a task done. Idempotent: completing an already-done task is a no-op."""
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")
    _ensure_plan_owner(admin, plan_id, user.id)

    task = (
        admin.table("tasks")
        .select("*")
        .eq("id", task_id)
        .eq("plan_id", plan_id)
        .single()
        .execute()
        .data
    )
    if not task:
        raise HTTPException(404, "Task not found")

    if task.get("done"):
        return TaskCompleteResponse(
            task=TaskOut(**task),
            xp_awarded=0,
            pillar_xp_awarded=0,
            new_total_xp=int((admin.table("profiles").select("total_xp").eq("id", user.id).single().execute().data or {}).get("total_xp") or 0),
            new_level=int((admin.table("profiles").select("level").eq("id", user.id).single().execute().data or {}).get("level") or 1),
            leveled_up=False,
            streak=int((admin.table("profiles").select("current_streak").eq("id", user.id).single().execute().data or {}).get("current_streak") or 0),
        )

    # Mark done
    admin.table("tasks").update({
        "done": True,
        "completed_at": "now()",
    }).eq("id", task_id).execute()

    result = award_task_completion(
        admin,
        user_id=user.id,
        task_id=task_id,
        pillar=task["pillar"],
    )

    updated_task = admin.table("tasks").select("*").eq("id", task_id).single().execute().data
    return TaskCompleteResponse(
        task=TaskOut(**updated_task),
        **result,
    )
