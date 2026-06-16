"""TDD: JWT-based auth middleware.

The middleware must:
  • Reject requests with no Authorization header → 401
  • Reject requests with a malformed token → 401
  • Reject tokens signed with the wrong secret → 401
  • Reject tokens with the wrong audience → 401
  • Accept tokens signed with the configured secret + aud="authenticated"
  • Extract the user id from the `sub` claim
"""
import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from jose import jwt

from app.core.security import get_current_user, AuthUser


# ---------- Tiny app to exercise the dependency ----------

@pytest.fixture
def app():
    app = FastAPI()

    @app.get("/whoami")
    def whoami(user: AuthUser = Depends(get_current_user)):
        return {"id": user.id, "email": user.email}

    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def secret() -> str:
    return os.environ["SUPABASE_JWT_SECRET"]


def _make_token(secret: str, *, sub="user-1", aud="authenticated", email="t@x.io", **extra):
    payload = {"sub": sub, "aud": aud, "email": email}
    payload.update(extra)
    return jwt.encode(payload, secret, algorithm="HS256")


# ---------- Behavior ----------

class TestNoToken:
    def test_no_header_returns_401(self, client):
        r = client.get("/whoami")
        assert r.status_code == 401
        assert r.json()["detail"] == "Missing bearer token"

    def test_non_bearer_scheme_returns_401(self, client):
        r = client.get("/whoami", headers={"Authorization": "Basic abc"})
        assert r.status_code == 401


class TestInvalidToken:
    def test_garbage_token_returns_401(self, client):
        r = client.get("/whoami", headers={"Authorization": "Bearer not-a-jwt"})
        assert r.status_code == 401
        assert "Invalid token" in r.json()["detail"]

    def test_wrong_secret_returns_401(self, client, secret):
        bad = jwt.encode({"sub": "u", "aud": "authenticated"}, "wrong-secret-key-32-chars-long!!", algorithm="HS256")
        r = client.get("/whoami", headers={"Authorization": f"Bearer {bad}"})
        assert r.status_code == 401

    def test_wrong_audience_returns_401(self, client, secret):
        tok = _make_token(secret, aud="anon")
        r = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 401


class TestValidToken:
    def test_returns_user_id_from_sub(self, client, secret):
        tok = _make_token(secret, sub="user-test-42", email="hi@winx.dev")
        r = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        assert r.json() == {"id": "user-test-42", "email": "hi@winx.dev"}

    def test_missing_email_yields_none(self, client, secret):
        tok = jwt.encode({"sub": "user-x", "aud": "authenticated"}, secret, algorithm="HS256")
        r = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        assert r.json() == {"id": "user-x", "email": None}

    def test_missing_sub_returns_401(self, client, secret):
        tok = jwt.encode({"aud": "authenticated"}, secret, algorithm="HS256")
        r = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 401
        assert "subject" in r.json()["detail"]


class TestNoServerSecretConfigured:
    def test_500_when_secret_not_set(self, client, monkeypatch):
        monkeypatch.setattr("app.core.security.settings.supabase_jwt_secret", "")
        tok = _make_token("anything")
        r = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 500
        assert "not configured" in r.json()["detail"]
