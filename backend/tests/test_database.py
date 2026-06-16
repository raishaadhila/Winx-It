"""TDD: database schema.

The schema is pure SQL, so we test:
  • The file is well-formed (we can extract statements)
  • All expected tables are defined
  • RLS is enabled on every table
  • Foreign keys reference the right tables
  • Triggers fire on the right events
"""
import re
from pathlib import Path

import pytest


SCHEMA_PATH = Path(__file__).parent.parent / "sql" / "schema.sql"


@pytest.fixture(scope="module")
def schema_sql() -> str:
    return SCHEMA_PATH.read_text()


@pytest.fixture(scope="module")
def statements(schema_sql: str) -> list[str]:
    """Split the schema into individual SQL statements (rough split on `;`)."""
    # Strip comments first
    no_comments = re.sub(r"--[^\n]*", "", schema_sql)
    # Split on semicolons
    raw = [s.strip() for s in no_comments.split(";") if s.strip()]
    return raw


# ---------- Structural tests ----------

class TestTablesExist:
    @pytest.mark.parametrize("table", [
        "profiles",
        "pillar_xp",
        "plans",
        "tasks",
        "xp_events",
    ])
    def test_table_is_created(self, statements, table):
        assert any(
            re.search(rf"create\s+table.*\b{table}\b", s, re.IGNORECASE)
            for s in statements
        ), f"Table {table} not created"


class TestRowLevelSecurity:
    @pytest.mark.parametrize("table", [
        "profiles",
        "pillar_xp",
        "plans",
        "tasks",
        "xp_events",
    ])
    def test_rls_enabled(self, statements, table):
        # ALTER TABLE ... ENABLE ROW LEVEL SECURITY
        pattern = rf"alter\s+table\s+(public\.)?{table}\s+enable\s+row\s+level\s+security"
        assert any(re.search(pattern, s, re.IGNORECASE) for s in statements), \
            f"RLS not enabled on {table}"

    @pytest.mark.parametrize("table", [
        "profiles",
        "pillar_xp",
        "plans",
        "tasks",
        "xp_events",
    ])
    def test_user_scoped_policy_exists(self, statements, table):
        # At least one policy that uses auth.uid() = ...
        assert any(
            re.search(rf"auth\.uid\(\)\s*=\s*(id|user_id)", s, re.IGNORECASE)
            for s in statements
            if table in s.lower()
        ), f"No auth.uid() policy on {table}"


class TestForeignKeys:
    def test_profiles_references_auth_users(self, statements):
        assert any(
            re.search(r"references\s+auth\.users", s, re.IGNORECASE)
            for s in statements
        )

    def test_plans_references_profiles(self, statements):
        assert any(
            re.search(r"references\s+(public\.)?profiles", s, re.IGNORECASE)
            for s in statements
        )

    def test_tasks_references_plans_and_profiles(self, statements):
        plan_fk = any(
            re.search(r"references\s+(public\.)?plans", s, re.IGNORECASE)
            for s in statements
        )
        profile_fk = any(
            re.search(r"references\s+(public\.)?profiles", s, re.IGNORECASE)
            for s in statements
        )
        assert plan_fk and profile_fk


class TestTriggers:
    def test_new_user_trigger_exists(self, statements):
        # after insert on auth.users → calls handle_new_user
        assert any(
            "on_auth_user_created" in s and "auth.users" in s
            for s in statements
        )

    def test_handle_new_user_function_creates_profile(self, schema_sql):
        # The function should insert into profiles + pillar_xp
        # We search the raw SQL because the function body contains `;` and
        # gets fragmented by our naive statement splitter.
        fn_match = re.search(
            r"create or replace function public\.handle_new_user.*?\$\$(.*?)\$\$",
            schema_sql,
            re.DOTALL | re.IGNORECASE,
        )
        assert fn_match, "handle_new_user function not found"
        body = fn_match.group(1)
        assert "profiles" in body, "handle_new_user does not insert into profiles"
        assert "pillar_xp" in body, "handle_new_user does not insert into pillar_xp"

    def test_updated_at_triggers(self, statements):
        # touch_updated_at + at least 3 triggers (profiles, plans, tasks)
        assert any("touch_updated_at" in s for s in statements)
        touch_count = sum(1 for s in statements if "before update" in s.lower() and "execute function public.touch_updated_at" in s.lower())
        assert touch_count >= 3, f"Expected ≥3 updated_at triggers, found {touch_count}"


class TestConstraints:
    def test_check_constraints_for_status(self, statements):
        assert any(
            "status" in s and "check" in s.lower() and "active" in s
            for s in statements
        )

    def test_check_constraints_for_pillar_values(self, statements):
        # The 5 pillars should all be allowed in the pillar column
        pillar_check = " ".join(s for s in statements if "pillar" in s and "check" in s.lower())
        for p in ("tecna", "flora", "musa", "bloom", "stella"):
            assert p in pillar_check, f"Missing pillar check for {p}"


class TestIndexes:
    def test_plans_user_id_indexed(self, statements):
        assert any(
            "plans_user_id_idx" in s
            for s in statements
        )

    def test_tasks_user_id_date_indexed(self, statements):
        assert any(
            "tasks_user_id_date_idx" in s
            for s in statements
        )


class TestExtensions:
    def test_pgcrypto_enabled(self, statements):
        assert any(
            "pgcrypto" in s.lower()
            for s in statements
        )
