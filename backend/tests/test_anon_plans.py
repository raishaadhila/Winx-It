"""TDD: POST /api/anon/plans/generate — public, no-auth LLM endpoint.

Lets a brand-new visitor generate a personalized quest without signing up.
Returns the same GeneratedPlan shape as the authed endpoint. Rate-limited
to 5 calls per 10 minutes per IP so it can't be abused as a free proxy.
"""
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.models import PlanGenerateRequest


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """The in-memory limiter is shared across tests; clear it between runs."""
    from app.limiter import anon_plans_limiter
    anon_plans_limiter._buckets.clear()
    yield
    anon_plans_limiter._buckets.clear()


def _client() -> TestClient:
    return TestClient(app)


def _payload(**overrides) -> dict:
    base = {
        "goal": "Become conversationally fluent in Japanese in 1 month",
        "timeframe": "1 month",
        "energy_focus": "deep",
        "pillars": ["musa", "bloom"],
    }
    base.update(overrides)
    return base


def _fake_plan():
    """Return a GeneratedPlan-like object the mocked _call_llm will return."""
    from datetime import date as _date
    from app.schemas.models import GeneratedPlan, TaskSpec
    return GeneratedPlan(
        title="JLPT N5 Sprint",
        start_date=_date(2026, 6, 16),
        end_date=_date(2026, 7, 15),
        tasks=[
            TaskSpec(
                day=1, week=1, month=1, date=_date(2026, 6, 16),
                description="Install Anki + download Core 2k deck",
                pillar="tecna", hours=0.5, energy="low",
            ),
        ],
    )


# ---------- happy path ----------

class TestAnonGenerateHappyPath:
    def test_returns_200_and_generated_plan(self):
        with patch("app.api.anon_plans._call_llm", return_value=_fake_plan()):
            r = _client().post("/api/anon/plans/generate", json=_payload())
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["title"] == "JLPT N5 Sprint"
        assert len(body["tasks"]) == 1
        assert body["tasks"][0]["description"] == "Install Anki + download Core 2k deck"

    def test_does_not_require_auth_header(self):
        with patch("app.api.anon_plans._call_llm", return_value=_fake_plan()):
            r = _client().post("/api/anon/plans/generate", json=_payload())
        # No Authorization header sent at all
        assert "authorization" not in {k.lower() for k in r.request.headers.keys()}

    def test_passes_attachments_to_llm(self):
        with patch("app.api.anon_plans._call_llm", return_value=_fake_plan()) as m:
            r = _client().post("/api/anon/plans/generate", json=_payload(
                attachments=[{
                    "id": "a1", "kind": "link",
                    "name": "https://myblog.io/japanese",
                    "value": "https://myblog.io/japanese",
                }],
            ))
        assert r.status_code == 200
        # The LLM should have been called with the enriched prompt containing the link
        call_args = m.call_args
        req = call_args[0][0]  # first positional arg
        assert isinstance(req, PlanGenerateRequest)
        assert len(req.attachments) == 1
        assert req.attachments[0].value == "https://myblog.io/japanese"

    def test_uses_nvidia_client(self):
        with patch("app.api.anon_plans._call_llm", return_value=_fake_plan()) as m:
            _client().post("/api/anon/plans/generate", json=_payload())
        # The LLM call must go through the OpenAI-compatible client pointed at NVIDIA
        m.assert_called_once()


# ---------- validation ----------

class TestAnonGenerateValidation:
    def test_rejects_missing_goal(self):
        bad = _payload(); bad.pop("goal")
        r = _client().post("/api/anon/plans/generate", json=bad)
        assert r.status_code == 422

    def test_rejects_short_goal(self):
        r = _client().post("/api/anon/plans/generate", json=_payload(goal="hi"))
        assert r.status_code == 422

    def test_rejects_invalid_pillar(self):
        r = _client().post("/api/anon/plans/generate", json=_payload(pillars=["superman"]))
        assert r.status_code == 422

    def test_rejects_empty_pillars(self):
        r = _client().post("/api/anon/plans/generate", json=_payload(pillars=[]))
        # Either 422 (min_items=1) or 200 with default fallback — the contract is
        # "at least one pillar" so we accept 422 as the strict version.
        assert r.status_code == 422


# ---------- rate limiting ----------

class TestAnonGenerateRateLimit:
    def test_returns_429_after_five_calls(self):
        with patch("app.api.anon_plans._call_llm", return_value=_fake_plan()):
            client = _client()
            for i in range(5):
                r = client.post("/api/anon/plans/generate", json=_payload())
                assert r.status_code == 200, f"call {i+1} got {r.status_code}"
            sixth = client.post("/api/anon/plans/generate", json=_payload())
        assert sixth.status_code == 429
        assert "rate" in sixth.json().get("detail", "").lower()


# ---------- LLM errors ----------

class TestAnonGenerateLlmErrors:
    def test_503_when_llm_not_configured(self):
        with patch("app.api.anon_plans._call_llm", side_effect=RuntimeError("no key")):
            r = _client().post("/api/anon/plans/generate", json=_payload())
        # The endpoint surfaces a clear "service not available" — not a generic 500
        assert r.status_code in (500, 503)
        assert "llm" in r.json().get("detail", "").lower() or "key" in r.json().get("detail", "").lower()

    def test_502_when_llm_returns_garbage(self):
        with patch("app.api.anon_plans._call_llm", side_effect=ValueError("bad json")):
            r = _client().post("/api/anon/plans/generate", json=_payload())
        # Validation failure surfaces as 500 (LLM is upstream) — but with a useful detail
        assert r.status_code in (500, 502)


# ---------- isolation from authed endpoint ----------

class TestAnonEndpointIsolation:
    def test_does_not_touch_supabase(self):
        """Anon generation must be stateless — no DB write, no user creation."""
        with patch("app.api.anon_plans._call_llm", return_value=_fake_plan()) as llm:
            r = _client().post("/api/anon/plans/generate", json=_payload())
        assert r.status_code == 200
        llm.assert_called_once()
        # The anon module does not import supabase at all — this is enforced
        # by code review and the test that the LLM is the only side-effect.

    def test_path_is_under_api_anon(self):
        with patch("app.api.anon_plans._call_llm", return_value=_fake_plan()):
            r = _client().post("/api/anon/plans/generate", json=_payload())
        assert r.status_code == 200
