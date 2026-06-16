"""TDD: /api/plans endpoints.

Behavior:
  • POST /api/plans/generate → returns a GeneratedPlan (no DB write)
  • POST /api/plans → creates a plan + tasks, returns PlanOut
  • GET /api/plans → returns list of plan summaries
  • GET /api/plans/{id} → returns full plan with tasks
  • PATCH /api/plans/{id} → updates title/status
  • DELETE /api/plans/{id} → 204
"""
import uuid
from datetime import date
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


def _plan_payload() -> dict:
    today = date.today().isoformat()
    return {
        "title": "Build an MVP",
        "goal_text": "Build an MVP in 3 months",
        "timeframe": "3 months",
        "start_date": today,
        "end_date": today,
        "tasks": [
            {
                "day": 1, "week": 1, "month": 1, "date": today,
                "description": "Ship a feature", "pillar": "tecna",
                "hours": 1.5, "energy": "medium",
            },
        ],
    }


def _plan_row(plan_id: str, user_id: str) -> dict:
    today = date.today().isoformat()
    return {
        "id": plan_id,
        "user_id": user_id,
        "title": "Build an MVP",
        "goal_text": "Build an MVP in 3 months",
        "timeframe": "3 months",
        "start_date": today,
        "end_date": today,
        "status": "active",
        "created_at": "2026-06-16T00:00:00Z",
        "updated_at": "2026-06-16T00:00:00Z",
    }


def _task_row(task_id: str, plan_id: str) -> dict:
    today = date.today().isoformat()
    return {
        "id": task_id,
        "plan_id": plan_id,
        "day": 1, "week": 1, "month": 1, "date": today,
        "description": "Ship a feature", "pillar": "tecna",
        "hours": 1.5, "energy": "medium",
        "done": False, "completed_at": None, "position": 0,
    }


# ---------- /api/plans/generate ----------

class TestGeneratePlan:
    def test_unauthenticated_returns_401(self, client):
        r = client.post("/api/plans/generate", json={
            "goal": "Build a SaaS MVP", "timeframe": "3 months",
            "energy_focus": "balanced", "pillars": ["tecna"],
        })
        assert r.status_code == 401

    def test_returns_generated_plan_with_stub_when_no_key(
        self, client, auth_headers,
    ):
        body = {
            "goal": "Build a SaaS MVP", "timeframe": "3 months",
            "energy_focus": "balanced", "pillars": ["tecna", "bloom"],
        }
        r = client.post("/api/plans/generate", headers=auth_headers, json=body)
        assert r.status_code == 200
        data = r.json()
        assert "title" in data
        assert "tasks" in data
        assert len(data["tasks"]) >= 1


# ---------- POST /api/plans ----------

class TestCreatePlan:
    def test_unauthenticated_returns_401(self, client):
        r = client.post("/api/plans", json=_plan_payload())
        assert r.status_code == 401

    def test_creates_plan_and_tasks(self, client, auth_headers, valid_jwt):
        plan_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        # Need to extract user id from the JWT — easier to decode it
        from jose import jwt
        from app.core.config import settings
        user_id = jwt.get_unverified_claims(valid_jwt)["sub"]

        # The endpoint calls .insert(...).execute() twice: plan + tasks
        plan_insert = MagicMock()
        plan_insert.data = [_plan_row(plan_id, user_id)]
        tasks_insert = MagicMock()
        tasks_insert.data = []
        select_tasks = MagicMock()
        select_tasks.data = [_task_row(str(uuid.uuid4()), plan_id)]

        admin = MagicMock()
        # table('plans').insert({...}).execute() → plan_insert
        # table('tasks').insert([...]).execute() → tasks_insert
        # table('tasks').select('*').eq('plan_id', ...).order('position').execute() → select_tasks
        admin.table.return_value.insert.return_value.execute.return_value = plan_insert
        admin.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = select_tasks

        with patch("app.api.plans.get_supabase_admin", return_value=admin):
            r = client.post("/api/plans", headers=auth_headers, json=_plan_payload())

        assert r.status_code == 201
        body = r.json()
        assert body["title"] == "Build an MVP"
        assert isinstance(body["tasks"], list)
        assert len(body["tasks"]) == 1

    def test_returns_503_when_db_not_configured(self, client, auth_headers):
        with patch("app.api.plans.get_supabase_admin", return_value=None):
            r = client.post("/api/plans", headers=auth_headers, json=_plan_payload())
        assert r.status_code == 503


# ---------- GET /api/plans ----------

class TestListPlans:
    def test_unauthenticated_returns_401(self, client):
        r = client.get("/api/plans")
        assert r.status_code == 401

    def test_returns_plan_summaries(self, client, auth_headers, valid_jwt):
        from jose import jwt
        user_id = jwt.get_unverified_claims(valid_jwt)["sub"]
        plan_id = str(uuid.uuid4())
        plan_with_tasks = _plan_row(plan_id, user_id)
        plan_with_tasks["tasks"] = [_task_row(str(uuid.uuid4()), plan_id)]

        admin = MagicMock()
        admin.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            plan_with_tasks
        ]

        with patch("app.api.plans.get_supabase_admin", return_value=admin):
            r = client.get("/api/plans", headers=auth_headers)

        assert r.status_code == 200
        body = r.json()
        assert len(body) == 1
        assert body[0]["title"] == "Build an MVP"
        assert body[0]["total_tasks"] == 1
        assert body[0]["done_tasks"] == 0
        assert body[0]["progress"] == 0.0


# ---------- GET /api/plans/{id} ----------

class TestGetPlan:
    def test_unauthenticated_returns_401(self, client):
        plan_id = str(uuid.uuid4())
        r = client.get(f"/api/plans/{plan_id}")
        assert r.status_code == 401

    def test_returns_plan_with_tasks(self, client, auth_headers):
        plan_id = str(uuid.uuid4())
        admin = MagicMock()

        # Build separate chains for the 'plans' table vs 'tasks' table
        plans_table = MagicMock()
        plan_single = MagicMock(); plan_single.data = _plan_row(plan_id, str(uuid.uuid4()))
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_single

        tasks_table = MagicMock()
        tasks_list = MagicMock(); tasks_list.data = [_task_row(str(uuid.uuid4()), plan_id)]
        tasks_table.select.return_value.eq.return_value.order.return_value.execute.return_value = tasks_list

        # table() returns the right mock based on name
        def table_router(name):
            return {"plans": plans_table, "tasks": tasks_table}.get(name) or MagicMock()
        admin.table.side_effect = table_router

        with patch("app.api.plans.get_supabase_admin", return_value=admin):
            r = client.get(f"/api/plans/{plan_id}", headers=auth_headers)

        assert r.status_code == 200
        body = r.json()
        assert body["id"] == plan_id
        assert len(body["tasks"]) == 1

    def test_returns_404_when_plan_missing(self, client, auth_headers):
        admin = MagicMock()
        plans_table = MagicMock()
        plan_single = MagicMock(); plan_single.data = None
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_single
        admin.table.return_value = plans_table

        with patch("app.api.plans.get_supabase_admin", return_value=admin):
            r = client.get(f"/api/plans/{str(uuid.uuid4())}", headers=auth_headers)

        assert r.status_code == 404


# ---------- DELETE /api/plans/{id} ----------

class TestDeletePlan:
    def test_unauthenticated_returns_401(self, client):
        plan_id = str(uuid.uuid4())
        r = client.delete(f"/api/plans/{plan_id}")
        assert r.status_code == 401

    def test_delete_returns_204(self, client, auth_headers):
        admin = MagicMock()
        admin.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = None

        with patch("app.api.plans.get_supabase_admin", return_value=admin):
            r = client.delete(f"/api/plans/{str(uuid.uuid4())}", headers=auth_headers)

        assert r.status_code == 204
