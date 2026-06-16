"""Current user / profile / avatar endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import AuthUser, get_current_user
from app.db.supabase import get_supabase_admin, get_supabase_user
from app.schemas.models import AvatarUpdate, ProfileOut, ProfileUpdate
from app.services.xp_engine import xp_to_next

router = APIRouter(prefix="/api/me", tags=["me"])


def _build_profile(row: dict, pillar_row: dict) -> ProfileOut:
    return ProfileOut(
        id=row["id"],
        email=row["email"],
        name=row.get("name") or "Fairy",
        fairy=row.get("fairy") or "tecna",
        pillar=row.get("pillar") or "tecna",
        accent=row.get("accent") or "blue",
        avatar_seed=row.get("avatar_seed"),
        avatar_data_url=row.get("avatar_data_url"),
        goal_text=row.get("goal_text") or "",
        level=int(row.get("level") or 1),
        total_xp=int(row.get("total_xp") or 0),
        current_streak=int(row.get("current_streak") or 0),
        longest_streak=int(row.get("longest_streak") or 0),
        last_completed_date=row.get("last_completed_date"),
        pillar_xp={
            "tecna": int(pillar_row.get("tecna") or 0),
            "flora": int(pillar_row.get("flora") or 0),
            "musa": int(pillar_row.get("musa") or 0),
            "bloom": int(pillar_row.get("bloom") or 0),
            "stella": int(pillar_row.get("stella") or 0),
        },
        xp_to_next_level=xp_to_next(int(row.get("total_xp") or 0)),
    )


def _refetch(admin, user_id: str) -> ProfileOut:
    profile = admin.table("profiles").select("*").eq("id", user_id).single().execute().data
    pillar = admin.table("pillar_xp").select("*").eq("user_id", user_id).single().execute().data or {}
    return _build_profile(profile, pillar)


@router.get("", response_model=ProfileOut)
def me(user: Annotated[AuthUser, Depends(get_current_user)]):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")

    profile = admin.table("profiles").select("*").eq("id", user.id).single().execute().data
    if not profile:
        raise HTTPException(404, "Profile not found")
    pillar = admin.table("pillar_xp").select("*").eq("user_id", user.id).single().execute().data or {}
    return _build_profile(profile, pillar)


@router.put("/avatar", response_model=ProfileOut)
def update_avatar(
    body: AvatarUpdate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")

    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if patch:
        admin.table("profiles").update(patch).eq("id", user.id).execute()

    return _refetch(admin, user.id)


@router.patch("", response_model=ProfileOut)
def update_profile(
    body: ProfileUpdate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    """Update editable profile fields (name, personality, accent, goals, avatar image)."""
    admin = get_supabase_admin()
    if admin is None:
        raise HTTPException(503, "Database not configured")

    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if patch:
        admin.table("profiles").update(patch).eq("id", user.id).execute()

    return _refetch(admin, user.id)
