"""TDD: /api/plans/{id}/tasks endpoints + XP integration.

The most important test is `complete_task_awards_xp_and_marks_done`
which proves the wiring between the API, the DB write, and the XP engine
all works end-to-end (with the DB mocked).
"""
import uuid
from datetime import date
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


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
        "description": "Ship a feature", "pillar": "tecna",
        "hours": 1.5, "energy": "medium",
        "done": done, "completed_at": None, "position": 0,
    }


# ---------- POST /api/plans/{id}/tasks/{taskId}/complete ----------

class TestCompleteTask:
    def test_unauthenticated_returns_401(self, client):
        r = client.post(f"/api/plans/{uuid.uuid4()}/tasks/{uuid.uuid4()}/complete")
        assert r.status_code == 401

    def test_complete_marks_done_and_awards_xp(self, client, auth_headers):
        plan_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        open_task = _task_row(task_id, plan_id, done=False)
        done_task = _task_row(task_id, plan_id, done=True)
        done_task["completed_at"] = "2026-06-16T12:00:00Z"

        admin = MagicMock()
        plans_table = MagicMock()
        plan_owner = MagicMock(); plan_owner.data = {"id": plan_id}
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner

        tasks_table = MagicMock()
        # First call: select single task (with .eq('id').eq('plan_id').single()) → open_task
        # Second call: select single task (with .eq('id').single()) after update → done_task
        task_single_1 = MagicMock(); task_single_1.data = open_task
        task_single_2 = MagicMock(); task_single_2.data = done_task

        # The first chain: .eq().eq().single() (verify plan ownership uses .eq('id').eq('plan_id').single())
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner

        # The first task query: .select('*').eq('id', task_id).eq('plan_id', plan_id).single().execute() → open_task
        tasks_eq_eq = MagicMock()
        tasks_eq_eq.single.return_value.execute.return_value = task_single_1
        # The second task query: .select('*').eq('id', task_id).single().execute() → done_task
        tasks_eq_only = MagicMock()
        tasks_eq_only.single.return_value.execute.return_value = task_single_2

        # Distinguish the two: when called the first time, use the double-eq chain; second time, single-eq
        call_count = {"n": 0}
        def tasks_select_router(*args, **kwargs):
            m = MagicMock()
            call_count["n"] += 1
            if call_count["n"] == 1:
                m.eq.return_value.eq.return_value = tasks_eq_eq
            else:
                m.eq.return_value = tasks_eq_only
            return m
        tasks_table.select.side_effect = tasks_select_router
        tasks_table.update.return_value.eq.return_value.execute.return_value.data = None
        tasks_table.insert.return_value.execute.return_value.data = None

        # pillar_xp table for the +50 to pillar
        pillar_table = MagicMock()
        pillar_resp = MagicMock(); pillar_resp.data = {"tecna": 100}
        pillar_table.select.return_value.eq.return_value.single.return_value.execute.return_value = pillar_resp
        pillar_table.update.return_value.eq.return_value.execute.return_value.data = None

        # profiles table — two reads in award_task_completion
        profiles_table = MagicMock()
        profile_resp = MagicMock()
        profile_resp.data = {
            "total_xp": 100, "current_streak": 1, "longest_streak": 1,
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
        assert body["task"]["done"] is True
        assert body["xp_awarded"] == 50
        # 100 + 50 (task) + 400 (streak 2) = 550
        assert body["new_total_xp"] == 550
        assert body["streak"] == 2

    def test_complete_already_done_is_idempotent(self, client, auth_headers):
        plan_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        done_task = _task_row(task_id, plan_id, done=True)

        admin = MagicMock()
        plans_table = MagicMock()
        plan_owner = MagicMock(); plan_owner.data = {"id": plan_id}
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner

        tasks_table = MagicMock()
        task_single = MagicMock(); task_single.data = done_task
        tasks_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = task_single

        # Profile reads (xp, level, streak) for the idempotent branch
        profiles_table = MagicMock()
        def prof_resp(cols):
            r = MagicMock()
            r.data = {"total_xp": 200, "level": 1, "current_streak": 1}
            return r
        profiles_table.select.return_value.eq.return_value.single.return_value.execute.side_effect = [
            prof_resp("total_xp"), prof_resp("level"), prof_resp("current_streak"),
        ]

        def table_router(name):
            return {
                "plans": plans_table,
                "tasks": tasks_table,
                "profiles": profiles_table,
            }.get(name) or MagicMock()
        admin.table.side_effect = table_router

        with patch("app.api.tasks.get_supabase_admin", return_value=admin):
            r = client.post(
                f"/api/plans/{plan_id}/tasks/{task_id}/complete",
                headers=auth_headers,
            )

        assert r.status_code == 200
        body = r.json()
        # No new XP, no streak change
        assert body["xp_awarded"] == 0
        assert body["new_total_xp"] == 200
        assert body["leveled_up"] is False

    def test_returns_404_when_plan_missing(self, client, auth_headers):
        admin = MagicMock()
        plans_table = MagicMock()
        plan_owner = MagicMock(); plan_owner.data = None
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner
        admin.table.return_value = plans_table

        with patch("app.api.tasks.get_supabase_admin", return_value=admin):
            r = client.post(
                f"/api/plans/{uuid.uuid4()}/tasks/{uuid.uuid4()}/complete",
                headers=auth_headers,
            )
        assert r.status_code == 404

    def test_returns_404_when_task_missing(self, client, auth_headers):
        plan_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        admin = MagicMock()
        plans_table = MagicMock()
        plan_owner = MagicMock(); plan_owner.data = {"id": plan_id}
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner

        tasks_table = MagicMock()
        task_single = MagicMock(); task_single.data = None
        tasks_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = task_single

        def table_router(name):
            return {"plans": plans_table, "tasks": tasks_table}.get(name) or MagicMock()
        admin.table.side_effect = table_router

        with patch("app.api.tasks.get_supabase_admin", return_value=admin):
            r = client.post(
                f"/api/plans/{plan_id}/tasks/{task_id}/complete",
                headers=auth_headers,
            )
        assert r.status_code == 404


# ---------- PATCH /api/plans/{id}/tasks/{taskId} ----------

class TestUpdateTask:
    def test_unauthenticated_returns_401(self, client):
        r = client.patch(
            f"/api/plans/{uuid.uuid4()}/tasks/{uuid.uuid4()}",
            json={"description": "Updated"},
        )
        assert r.status_code == 401

    def test_updates_description(self, client, auth_headers):
        plan_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())

        admin = MagicMock()
        plans_table = MagicMock()
        plan_owner = MagicMock(); plan_owner.data = {"id": plan_id}
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner

        updated = _task_row(task_id, plan_id)
        updated["description"] = "Updated description"
        tasks_table = MagicMock()
        tasks_table.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = None
        tasks_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = updated

        def table_router(name):
            return {"plans": plans_table, "tasks": tasks_table}.get(name) or MagicMock()
        admin.table.side_effect = table_router

        with patch("app.api.tasks.get_supabase_admin", return_value=admin):
            r = client.patch(
                f"/api/plans/{plan_id}/tasks/{task_id}",
                headers=auth_headers,
                json={"description": "Updated description"},
            )

        assert r.status_code == 200
        assert r.json()["description"] == "Updated description"


# ---------- POST /api/plans/{id}/tasks ----------

class TestCreateTask:
    def test_unauthenticated_returns_401(self, client):
        today = date.today().isoformat()
        r = client.post(
            f"/api/plans/{uuid.uuid4()}/tasks",
            json={
                "day": 1, "week": 1, "month": 1, "date": today,
                "description": "New task", "pillar": "tecna",
                "hours": 1, "energy": "medium",
            },
        )
        assert r.status_code == 401

    def test_creates_task(self, client, auth_headers):
        plan_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        today = date.today().isoformat()

        admin = MagicMock()
        plans_table = MagicMock()
        plan_owner = MagicMock(); plan_owner.data = {"id": plan_id}
        plans_table.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = plan_owner

        tasks_table = MagicMock()
        created = _task_row(task_id, plan_id)
        tasks_table.insert.return_value.execute.return_value.data = [created]

        def table_router(name):
            return {"plans": plans_table, "tasks": tasks_table}.get(name) or MagicMock()
        admin.table.side_effect = table_router

        with patch("app.api.tasks.get_supabase_admin", return_value=admin):
            r = client.post(
                f"/api/plans/{plan_id}/tasks",
                headers=auth_headers,
                json={
                    "day": 1, "week": 1, "month": 1, "date": today,
                    "description": "New task", "pillar": "tecna",
                    "hours": 1, "energy": "medium",
                },
            )

        assert r.status_code == 201
        assert r.json()["description"] == "Ship a feature"  # from the mocked row
