"""LLM integration tests against the real DeepSeek-via-NVIDIA endpoint.

These tests are **skipped unless** NVIDIA_API_KEY is set in the .env file.
They verify:
  • The endpoint responds with valid structured output
  • The response parses into the GeneratedPlan schema
  • Errors are handled gracefully (network, invalid model, etc.)

The planner uses NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
which is the OpenAI-compatible NIM endpoint.
"""
import json
import os
from datetime import date
from pathlib import Path

import pytest


def _read_env_file() -> dict[str, str]:
    env_path = Path(__file__).parent.parent / ".env"
    if not env_path.exists():
        return {}
    out: dict[str, str] = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


_real_env = _read_env_file()
# Accept the key from either NVIDIA_API_KEY (new) or DEEPSEEK_API_KEY (legacy)
# — the user stored the NVIDIA key there before we locked to NVIDIA only.
_NVIDIA_KEY = _real_env.get("NVIDIA_API_KEY") or _real_env.get("DEEPSEEK_API_KEY", "")
_NVIDIA_BASE = _real_env.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
# Use the org-prefixed model name by default — this is NVIDIA NIM's convention.
# The user may have a non-prefixed legacy value in .env; the Settings default
# in app/core/config.py is `deepseek-ai/deepseek-v4-flash`.
_NVIDIA_MODEL = (
    "deepseek-ai/" + _real_env["DEEPSEEK_MODEL"]
    if "DEEPSEEK_MODEL" in _real_env and "/" not in _real_env["DEEPSEEK_MODEL"]
    else _real_env.get("NVIDIA_MODEL", _real_env.get("DEEPSEEK_MODEL", "deepseek-ai/deepseek-v4-flash"))
)

# Skip if no real key, or key is a placeholder
pytestmark = pytest.mark.skipif(
    not _NVIDIA_KEY or _NVIDIA_KEY.startswith("nvapi-YOUR") or "test" in _NVIDIA_KEY,
    reason="Real NVIDIA_API_KEY not configured in .env (set NVIDIA_API_KEY=nvapi-...)",
)


# ---------- Real call ----------

class TestRealNimCall:
    def test_generate_plan_returns_valid_structured_output(self):
        """The real DeepSeek-via-NVIDIA model returns JSON matching our schema."""
        from openai import OpenAI

        client = OpenAI(
            api_key=_NVIDIA_KEY,
            base_url=_NVIDIA_BASE,
        )

        # Use the planner's Pydantic schema for strict output
        from app.schemas.models import GeneratedPlan
        schema = GeneratedPlan.model_json_schema()

        from app.services.ai_planner import SYSTEM_PROMPT
        today = date.today().isoformat()
        user_prompt = (
            f"GOAL: Learn Spanish in 1 month\n"
            f"TIMEFRAME: 1 month ({30} days, starting {today})\n"
            f"ENERGY FOCUS: balanced\n"
            f"PILLARS TO COVER: tecna, flora, musa\n\n"
            f"Generate a complete 30-day quest plan. Each task must include day, week, "
            f"month, date, description, pillar, hours, energy."
        )

        completion = client.chat.completions.create(
            model=_NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "plan", "schema": schema, "strict": True},
            },
            temperature=0.7,
            timeout=60,
        )

        raw = completion.choices[0].message.content
        data = json.loads(raw)
        plan = GeneratedPlan.model_validate(data)

        # Verify shape
        assert plan.title
        assert plan.start_date == today
        assert plan.end_date
        assert len(plan.tasks) >= 1
        # Tasks should be in the chosen pillars (mostly)
        pillars_used = {t.pillar for t in plan.tasks}
        assert pillars_used.issubset({"tecna", "flora", "musa", "bloom", "stella"})

    def test_planner_module_succeeds_with_real_key(self):
        """Calling the planner module directly (not via the API) with a real key."""
        from app.services.ai_planner import generate_plan
        from app.schemas.models import PlanGenerateRequest

        result = generate_plan(PlanGenerateRequest(
            goal="Run a 5k in 6 weeks",
            timeframe="1 month",
            energy_focus="physical",
            pillars=["stella", "flora"],
        ))
        assert result.title
        assert result.start_date
        assert result.end_date
        assert len(result.tasks) >= 1

    def test_model_name_in_response(self):
        """Verify the model name in the response matches what we configured."""
        from openai import OpenAI
        from app.schemas.models import GeneratedPlan
        from app.services.ai_planner import SYSTEM_PROMPT

        client = OpenAI(api_key=_NVIDIA_KEY, base_url=_NVIDIA_BASE)
        completion = client.chat.completions.create(
            model=_NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"GOAL: test. Generate a 7-day plan. today={date.today().isoformat()}"},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "plan",
                    "schema": GeneratedPlan.model_json_schema(),
                    "strict": True,
                },
            },
            temperature=0,
            timeout=60,
        )
        # OpenAI's response includes the model name
        assert completion.model == _NVIDIA_MODEL or _NVIDIA_MODEL in completion.model


# ---------- Error handling ----------

class TestErrorHandling:
    def test_invalid_model_raises_error(self):
        """An unknown model should raise, not silently fall back."""
        from openai import OpenAI
        from app.schemas.models import GeneratedPlan
        from app.services.ai_planner import SYSTEM_PROMPT

        client = OpenAI(api_key=_NVIDIA_KEY, base_url=_NVIDIA_BASE)
        with pytest.raises(Exception):
            client.chat.completions.create(
                model="not-a-real-model",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": "hi"},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "plan",
                        "schema": GeneratedPlan.model_json_schema(),
                        "strict": True,
                    },
                },
                timeout=30,
            )

    def test_invalid_api_key_raises_error(self):
        """A bad API key should raise an auth error from NIM."""
        from openai import OpenAI
        from app.schemas.models import GeneratedPlan
        from app.services.ai_planner import SYSTEM_PROMPT

        client = OpenAI(api_key="nvapi-bogus-key", base_url=_NVIDIA_BASE)
        with pytest.raises(Exception):
            client.chat.completions.create(
                model=_NVIDIA_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": "hi"},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "plan",
                        "schema": GeneratedPlan.model_json_schema(),
                        "strict": True,
                    },
                },
                timeout=30,
            )
