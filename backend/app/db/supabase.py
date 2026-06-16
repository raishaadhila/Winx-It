"""Supabase client (server-side, uses service key to bypass RLS)."""
from functools import lru_cache
from supabase import Client, create_client

from app.core.config import settings


@lru_cache
def get_supabase_admin() -> Client | None:
    if not settings.supabase_url or not settings.supabase_service_key:
        return None
    return create_client(settings.supabase_url, settings.supabase_service_key)


def get_supabase_user(jwt: str) -> Client:
    """Build a per-request client scoped to the caller's JWT (honors RLS)."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase not configured")
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(jwt)
    return client
