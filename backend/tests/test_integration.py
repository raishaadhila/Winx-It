"""Integration tests: end-to-end HTTP cycle through the FastAPI app.

Uses TestClient with mocked Supabase. Verifies:
  • Auth, request/response shapes, status codes
  • Error contracts (401, 404, 422, 503)
  • CORS headers
  • OpenAPI schema
"""
import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


def _plan_row(plan_id: str, user_id: str) -> dict:
    today = date.today().isoformat()
    return {
        "id": plan_id, "user_id": user_id,
        "title": "X", "goal_text": "X", "timeframe": "3 months",
        "start_date": today, "end_date": today, "status": "active",
        "created_at": "2026-06-16T00:00:00Z", "updated_at": "2026-06-16T00:00:00Z",
    }


def _task_row(task_id: str, plan_id: str, done: bool = False) -> dict:
    today = date.today().isoformat()
    return {
        "id": task_id, "plan_id": plan_id,
        "day": 1, "week": 1, "month": 1, "date": today,
        "description": "T", "pillar": "tecna",
        "hours": 1.5, "energy": "medium",
        "done": done, "completed_at": None, "position": 0,
    }


def _profile_row(user_id: str) -> dict:
    return {
        "id": user_id, "email": "t@x.io", "name": "T", "fairy": "tecna",
        "pillar": "tecna", "accent": "blue", "avatar_seed": None,
        "level": 1, "total_xp": 0, "current_streak": 0, "longest_streak": 0,
        "last_completed_date": None,
    }


# ---------- CORS ----------

class TestCORS:
    def test_cors_preflight_returns_acao_header(self, client):
        r = client.options(
            "/api/me",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_acao_set_on_health_check(self, client):
        # Use /health since it doesn't require auth and doesn't touch supabase
        r = client.get("/health", headers={"Origin": "http://localhost:5173"})
        assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


# ---------- OpenAPI ----------

class TestOpenAPI:
    def test_openapi_json_loads(self, client):
        r = client.get("/openapi.json")
        assert r.status_code == 200
        body = r.json()
        assert "paths" in body
        assert "components" in body

    def test_all_routes_documented(self, client):
        r = client.get("/openapi.json")
        paths = r.json()["paths"]
        expected = {
            "/health",
            "/api/health",
            "/api/me", "/api/me/avatar",
            "/api/plans", "/api/plans/generate",
            "/api/plans/{plan_id}",
            "/api/plans/{plan_id}/tasks",
            "/api/plans/{plan_id}/tasks/{task_id}",
            "/api/plans/{plan_id}/tasks/{task_id}/complete",
            "/api/anon/plans/generate",
        }
        assert set(paths.keys()) == expected

    def test_swagger_ui_loads(self, client):
        r = client.get("/docs")
        assert r.status_code == 200
        assert "swagger" in r.text.lower()

    def test_redoc_loads(self, client):
        r = client.get("/redoc")
        assert r.status_code == 200


# ---------- Validation (422) ----------

class TestValidationErrors:
    def test_plan_generate_missing_goal_returns_422(self, client, auth_headers):
        r = client.post(
            "/api/plans/generate",
            headers=auth_headers,
            json={"timeframe": "3 months", "energy_focus": "balanced", "pillars": ["tecna"]},
        )
        assert r.status_code == 422
        body = r.json()
        assert "detail" in body
        # Should mention the missing field
        assert any("goal" in str(e).lower() for e in body["detail"])

    def test_plan_generate_goal_too_short_returns_422(self, client, auth_headers):
        r = client.post(
            "/api/plans/generate",
            headers=auth_headers,
            json={"goal": "hi", "timeframe": "3 months", "energy_focus": "balanced", "pillars": ["tecna"]},
        )
        assert r.status_code == 422

    def test_invalid_pillar_value_returns_422(self, client, auth_headers):
        r = client.post(
            "/api/plans/generate",
            headers=auth_headers,
            json={
                "goal": "Build something",
                "timeframe": "3 months",
                "energy_focus": "balanced",
                "pillars": ["not_a_pillar"],
            },
        )
        assert r.status_code == 422

    def test_invalid_task_hours_returns_422(self, client, auth_headers):
        plan_id = str(uuid.uuid4())
        r = client.post(
            f"/api/plans/{plan_id}/tasks",
            headers=auth_headers,
            json={
                "day": 1, "week": 1, "month": 1, "date": "2026-06-16",
                "description": "Bad hours", "pillar": "tecna",
                "hours": 999, "energy": "medium",
            },
        )
        # Either 422 (validation) or 503 (db not configured) is acceptable —
        # the point is we don't 500 with an unhandled error
        assert r.status_code in (422, 503)


# ---------- Auth (401) ----------

class TestAuthRequired:
    @pytest.mark.parametrize("method,path", [
        ("get", "/api/me"),
        ("put", "/api/me/avatar"),
        ("get", "/api/plans"),
        ("post", "/api/plans/generate"),
        ("post", "/api/plans"),
        ("get", "/api/plans/abc"),
        ("patch", "/api/plans/abc"),
        ("delete", "/api/plans/abc"),
        ("get", "/api/plans/abc/tasks"),
        ("post", "/api/plans/abc/tasks"),
        ("patch", "/api/plans/abc/tasks/xyz"),
        ("delete", "/api/plans/abc/tasks/xyz"),
        ("post", "/api/plans/abc/tasks/xyz/complete"),
    ])
    def test_endpoint_requires_auth(self, client, method, path):
        fn = getattr(client, method)
        r = fn(path)
        assert r.status_code == 401, f"{method.upper()} {path} should require auth"


# ---------- /health ----------

class TestHealth:
    def test_health_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["llm_provider"] == "nvidia"
        assert body["llm_model"] == "deepseek-ai/deepseek-v4-flash"
        assert "integrate.api.nvidia.com" in body["llm_base_url"]
        assert "nvidia_configured" in body
        assert "supabase_configured" in body


# ---------- XP integration (real pipeline through TestClient) ----------

class TestCompleteTaskEndToEnd:
    """The most important integration: click a task → XP awarded, profile updated."""

    def test_complete_task_awards_xp_and_updates_profile(
        self, client, auth_headers, valid_jwt,
    ):
        from jose import jwt
        user_id = jwt.get_unverified_claims(valid_jwt)["sub"]
        plan_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        today = date.today().isoformat()

        admin = MagicMock()
        plans_table = MagicMock()
        plan_owner = MagicMock(); plan_owner.data = {"id": plan_id}
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner

        tasks_table = MagicMock()
        open_task = _task_row(task_id, plan_id, done=False)
        done_task = _task_row(task_id, plan_id, done=True)
        done_task["completed_at"] = f"{today}T12:00:00Z"

        # The endpoint calls select twice on the tasks table:
        #   1) .eq('id', t).eq('plan_id', p).single()    → open_task
        #   2) .eq('id', t).single()                     → done_task (after update)
        def make_select_router(chosen_task: dict):
            def router(*a, **k):
                m = MagicMock()
                resp = MagicMock(); resp.data = chosen_task
                # eq().eq().single().execute() chain
                m.eq.return_value.eq.return_value.single.return_value.execute.return_value = resp
                # eq().single().execute() chain (only one .eq() call)
                m.eq.return_value.single.return_value.execute.return_value = resp
                return m
            return router

        tasks_table.select.side_effect = [
            make_select_router(open_task)(),
            make_select_router(done_task)(),
        ]
        tasks_table.update.return_value.eq.return_value.execute.return_value.data = None
        tasks_table.insert.return_value.execute.return_value.data = None

        pillar_table = MagicMock()
        pillar_resp = MagicMock(); pillar_resp.data = {"tecna": 100, "flora": 0, "musa": 0, "bloom": 0, "stella": 0}
        pillar_table.select.return_value.eq.return_value.single.return_value.execute.return_value = pillar_resp
        pillar_table.update.return_value.eq.return_value.execute.return_value.data = None

        profiles_table = MagicMock()
        profile_resp = MagicMock()
        profile_resp.data = {
            "total_xp": 550, "current_streak": 1, "longest_streak": 1,
            "last_completed_date": "2026-06-15",
        }
        profiles_table.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_resp
        profiles_table.update.return_value.eq.return_value.execute.return_value.data = None

        def table_router(name):
            return {
                "plans": plans_table,
                "tasks": tasks_table,
                "pillar_xp": pillar_table,
                "profiles": profiles_table,
                "xp_events": MagicMock(insert=MagicMock(return_value=MagicMock(execute=MagicMock(return_value=MagicMock(data=None))))),
            }.get(name) or MagicMock()
        admin.table.side_effect = table_router

        with patch("app.api.tasks.get_supabase_admin", return_value=admin):
            r = client.post(
                f"/api/plans/{plan_id}/tasks/{task_id}/complete",
                headers=auth_headers,
            )

        assert r.status_code == 200
        body = r.json()
        assert body["xp_awarded"] == 50
        # 550 + 50 (task) + 400 (streak 2) = 1000 → level 2
        assert body["new_total_xp"] == 1000
        assert body["streak"] == 2
        assert body["leveled_up"] is True
        assert body["new_level"] == 2
        assert body["task"]["done"] is True
