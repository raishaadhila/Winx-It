"""Shared test fixtures."""

import os
import uuid
from typing import Iterator

# Test environment MUST be set before importing any app modules so that
# Settings() picks up the test values, not whatever is in .env.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-must-be-at-least-32-chars-long")
os.environ.setdefault("NVIDIA_API_KEY", "")

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app


USER_UUID = str(uuid.uuid4())


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Synchronous FastAPI test client."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def valid_jwt() -> str:
    """Build a valid Supabase-shaped HS256 JWT for tests.

    The token's `sub` is the user id, `aud` is `authenticated`, and the
    signature is computed with the SUPABASE_JWT_SECRET set above.
    """
    from jose import jwt

    return jwt.encode(
        {
            "sub": USER_UUID,
            "email": "test@winx.dev",
            "aud": "authenticated",
            "role": "authenticated",
        },
        os.environ["SUPABASE_JWT_SECRET"],
        algorithm="HS256",
    )


@pytest.fixture
def auth_headers(valid_jwt: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {valid_jwt}"}


@pytest.fixture
def sample_profile() -> dict:
    return {
        "id": USER_UUID,
        "email": "test@winx.dev",
        "name": "Test Fairy",
        "fairy": "tecna",
        "pillar": "tecna",
        "accent": "blue",
        "avatar_seed": None,
        "level": 5,
        "total_xp": 4200,
        "current_streak": 7,
        "longest_streak": 14,
        "last_completed_date": "2026-06-15",
    }


@pytest.fixture
def sample_pillar_xp() -> dict:
    return {
        "tecna": 1200,
        "flora": 900,
        "musa": 700,
        "bloom": 600,
        "stella": 800,
    }
