"""TDD: AI planner (DeepSeek via NVIDIA NIM only).

The planner must:
  • Build a 1/3/6 month / custom-day plan based on `timeframe`
  • Call the NVIDIA NIM endpoint with model `deepseek-ai/deepseek-v4-flash`
  • Send a `response_format=json_schema` request with the GeneratedPlan schema
  • Validate the model's response against the Pydantic model
  • Fall back to a deterministic stub when no NVIDIA key is set
"""
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings
from app.schemas.models import GeneratedPlan, PlanGenerateRequest


@pytest.fixture
def sample_request() -> PlanGenerateRequest:
    return PlanGenerateRequest(
        goal="Build a SaaS MVP while staying healthy",
        timeframe="3 months",
        energy_focus="balanced",
        pillars=["tecna", "bloom", "stella"],
    )


def _patch_nvidia(
    monkeypatch,
    *,
    api_key: str = "",
    model: str = "deepseek-ai/deepseek-v4-flash",
    base_url: str = "https://integrate.api.nvidia.com/v1",
):
    """Patch the NVIDIA_* fields on the settings singleton."""
    from app.services import ai_planner

    s = ai_planner.settings
    originals = {
        "nvidia_api_key": s.nvidia_api_key,
        "nvidia_model": s.nvidia_model,
        "nvidia_base_url": s.nvidia_base_url,
    }
    object.__setattr__(s, "nvidia_api_key", api_key)
    object.__setattr__(s, "nvidia_model", model)
    object.__setattr__(s, "nvidia_base_url", base_url)
    yield
    for k, v in originals.items():
        object.__setattr__(s, k, v)


# ---------- Timeframe math (pure) ----------

class TestDaysFor:
    """The internal _days_for is used to compute task date range."""

    def test_1_month_is_30_days(self, sample_request):
        from app.services.ai_planner import _days_for
        sample_request.timeframe = "1 month"
        assert _days_for(sample_request) == 30

    def test_3_months_is_90_days(self, sample_request):
        from app.services.ai_planner import _days_for
        sample_request.timeframe = "3 months"
        assert _days_for(sample_request) == 90

    def test_6_months_is_180_days(self, sample_request):
        from app.services.ai_planner import _days_for
        sample_request.timeframe = "6 months"
        assert _days_for(sample_request) == 180

    def test_custom_uses_custom_days(self, sample_request):
        from app.services.ai_planner import _days_for
        sample_request.timeframe = "custom"
        sample_request.custom_days = 45
        assert _days_for(sample_request) == 45

    def test_custom_caps_at_365(self, sample_request):
        from app.services.ai_planner import _days_for
        sample_request.timeframe = "custom"
        sample_request.custom_days = 9999
        assert _days_for(sample_request) == 365

    def test_default_falls_back_to_90(self, sample_request):
        from app.services.ai_planner import _days_for
        sample_request.timeframe = "custom"
        sample_request.custom_days = None
        assert _days_for(sample_request) == 90


# ---------- Stub fallback ----------

class TestStubFallback:
    """When no NVIDIA key is configured, planner returns a deterministic stub."""

    def test_returns_generated_plan_when_no_key(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(monkeypatch, api_key=""):
            plan = ai_planner.generate_plan(sample_request)
            assert isinstance(plan, GeneratedPlan)

    def test_stub_uses_21_tasks_for_3_months(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(monkeypatch, api_key=""):
            plan = ai_planner.generate_plan(sample_request)
            assert len(plan.tasks) == 21

    def test_stub_title_extracted_from_goal(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(monkeypatch, api_key=""):
            plan = ai_planner.generate_plan(sample_request)
            assert "Build A" in plan.title
            assert "Mvp" in plan.title

    def test_stub_cycles_through_pillars(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(monkeypatch, api_key=""):
            plan = ai_planner.generate_plan(sample_request)
            pillars_seen = {t.pillar for t in plan.tasks}
            assert pillars_seen == {"tecna", "bloom", "stella"}


# ---------- Real NVIDIA NIM call (with mocked OpenAI client) ----------

class TestCallsNvidiaNim:
    """When NVIDIA key is set, the planner must call the NIM endpoint
    with the configured model name."""

    def test_uses_nvidia_base_url_and_model(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(monkeypatch, api_key="nvapi-test-123"):
            captured = {}

            def fake_completion_create(*args, **kwargs):
                captured["model"] = kwargs.get("model")
                msg = MagicMock()
                msg.content = _stub_plan_json()
                choice = MagicMock()
                choice.message = msg
                response = MagicMock()
                response.choices = [choice]
                return response

            with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
                client_instance = MagicMock()
                client_instance.chat.completions.create.side_effect = fake_completion_create
                MockOpenAI.return_value = client_instance

                plan = ai_planner.generate_plan(sample_request)

            # OpenAI client constructed with the right base_url + api_key
            init_kwargs = MockOpenAI.call_args.kwargs
            assert init_kwargs["api_key"] == "nvapi-test-123"
            assert init_kwargs["base_url"] == "https://integrate.api.nvidia.com/v1"

            # Model name is the NVIDIA catalog name
            assert captured["model"] == "deepseek-ai/deepseek-v4-flash"

            # Response was parsed
            assert isinstance(plan, GeneratedPlan)
            assert plan.title == "Build A Saas Mvp While Staying Healthy"

    def test_custom_model_name_is_used(self, sample_request, monkeypatch):
        """If NVIDIA_MODEL is overridden in env, the planner must use it."""
        from app.services import ai_planner

        for _ in _patch_nvidia(
            monkeypatch, api_key="nvapi-x",
            model="deepseek-ai/deepseek-r1",
        ):
            captured = {}

            def fake(*args, **kwargs):
                captured["model"] = kwargs.get("model")
                msg = MagicMock(); msg.content = _stub_plan_json()
                choice = MagicMock(); choice.message = msg
                resp = MagicMock(); resp.choices = [choice]
                return resp

            with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
                cli = MagicMock()
                cli.chat.completions.create.side_effect = fake
                MockOpenAI.return_value = cli
                ai_planner.generate_plan(sample_request)

            assert captured["model"] == "deepseek-ai/deepseek-r1"

    def test_custom_base_url_is_used(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(
            monkeypatch, api_key="nvapi-x",
            base_url="https://my-proxy.example.com/v1",
        ):
            with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
                cli = MagicMock()
                msg = MagicMock(); msg.content = _stub_plan_json()
                choice = MagicMock(); choice.message = msg
                resp = MagicMock(); resp.choices = [choice]
                cli.chat.completions.create.return_value = resp
                MockOpenAI.return_value = cli
                ai_planner.generate_plan(sample_request)

            assert MockOpenAI.call_args.kwargs["base_url"] == "https://my-proxy.example.com/v1"


# ---------- Structured output ----------

class TestUsesStructuredOutput:
    """The planner must request JSON schema-validated output."""

    def test_response_format_is_json_schema(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(monkeypatch, api_key="nvapi-test"):
            captured = {}

            def fake(*args, **kwargs):
                captured.update(kwargs)
                msg = MagicMock(); msg.content = _stub_plan_json()
                choice = MagicMock(); choice.message = msg
                resp = MagicMock(); resp.choices = [choice]
                return resp

            with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
                cli = MagicMock()
                cli.chat.completions.create.side_effect = fake
                MockOpenAI.return_value = cli
                ai_planner.generate_plan(sample_request)

            rf = captured["response_format"]
            assert rf["type"] == "json_schema"
            assert rf["json_schema"]["strict"] is True
            assert "schema" in rf["json_schema"]

    def test_temperature_set(self, sample_request, monkeypatch):
        from app.services import ai_planner

        for _ in _patch_nvidia(monkeypatch, api_key="nvapi-test"):
            captured = {}

            def fake(*args, **kwargs):
                captured.update(kwargs)
                msg = MagicMock(); msg.content = _stub_plan_json()
                choice = MagicMock(); choice.message = msg
                resp = MagicMock(); resp.choices = [choice]
                return resp

            with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
                cli = MagicMock()
                cli.chat.completions.create.side_effect = fake
                MockOpenAI.return_value = cli
                ai_planner.generate_plan(sample_request)

            assert 0 <= captured["temperature"] <= 2


# ---------- Provider: only NVIDIA ----------

class TestProviderLock:
    """The system has exactly one LLM provider: NVIDIA. There is no
    OpenAI fallback and no direct DeepSeek API option."""

    def test_settings_has_no_openai_field(self):
        assert not hasattr(Settings(), "openai_api_key")
        assert not hasattr(Settings(), "openai_model")

    def test_settings_has_no_deepseek_direct_field(self):
        assert not hasattr(Settings(), "deepseek_api_key")
        assert not hasattr(Settings(), "deepseek_base_url")

    def test_nvidia_fields_exist(self):
        s = Settings()
        assert s.nvidia_model == "deepseek-ai/deepseek-v4-flash"
        assert s.nvidia_base_url == "https://integrate.api.nvidia.com/v1"

    def test_llm_configured_only_when_nvidia_key_set(self, monkeypatch):
        from app.services import ai_planner

        object.__setattr__(ai_planner.settings, "nvidia_api_key", "")
        assert ai_planner.settings.llm_configured is False

        object.__setattr__(ai_planner.settings, "nvidia_api_key", "nvapi-anything")
        assert ai_planner.settings.llm_configured is True

        # Cleanup
        object.__setattr__(ai_planner.settings, "nvidia_api_key", "")


# ---------- Helpers ----------

def _stub_plan_json() -> str:
    import json
    today = date.today().isoformat()
    return json.dumps({
        "title": "Build A Saas Mvp While Staying Healthy",
        "start_date": today,
        "end_date": today,
        "tasks": [
            {
                "day": 1, "week": 1, "month": 1, "date": today,
                "description": "Ship a feature", "pillar": "tecna",
                "hours": 1.5, "energy": "medium",
            },
        ],
    })
