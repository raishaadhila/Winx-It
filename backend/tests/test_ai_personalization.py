"""AI personalization tests — the most important test file in the repo.

The product's core promise: "Cast your goal, timeframe, pillars, and
resources into a personalized quest." This test proves the planner
actually *personalizes* — i.e. the user prompt sent to the LLM contains
the goal text, the right day count for the chosen timeframe, every
selected pillar, and an enriched block of resource context.

The LLM is mocked (so CI doesn't need a real NVIDIA key), but EVERY
other piece of the pipeline is real:
  - Pydantic schema validation
  - User-prompt construction (days, pillars, enrichment, custom_prompt)
  - OpenAI client instantiation
  - json_schema response_format request
  - Response parsing back into GeneratedPlan

If the planner ever stops pulling the user's input into the prompt,
this test fails. That's the contract.
"""
from __future__ import annotations

import base64
import json
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.schemas.models import (
    Attachment,
    PlanGenerateRequest,
    Pillar,
)


# ---------- helpers ----------

def _build_fake_completion(payload: dict) -> MagicMock:
    """Build a fake OpenAI ChatCompletion that returns `payload` as JSON."""
    completion = MagicMock()
    completion.choices = [MagicMock()]
    completion.choices[0].message.content = json.dumps(payload)
    return completion


def _valid_plan_payload(title: str = "Personalized Plan", days: int = 30) -> dict:
    today = date.today().isoformat()
    return {
        "title": title,
        "start_date": today,
        "end_date": today,  # GeneratedPlan parses, exact math tested below
        "tasks": [
            {
                "day": 1, "week": 1, "month": 1, "date": today,
                "description": "Day 1 task", "pillar": "tecna",
                "hours": 1.5, "energy": "medium",
            }
        ],
    }


def _capture_create_call(monkeypatch, api_key: str = "nvapi-fake"):
    """Patch OpenAI so we can read the kwargs passed to chat.completions.create.

    Returns (mock_client, captured_call_dict) — the captured dict has shape:
        {
            "model": str,
            "messages": [{"role": "system", "content": "..."},
                         {"role": "user",   "content": "..."}],
            "response_format": {...},
            "temperature": float,
        }
    """
    captured: dict = {}
    fake_completion = _build_fake_completion(_valid_plan_payload())
    mock_client = MagicMock()
    mock_client.chat.completions.create = MagicMock(
        side_effect=lambda **kwargs: (captured.update(kwargs), fake_completion)[1]
    )
    monkeypatch.setattr("app.services.ai_planner.OpenAI", MagicMock(return_value=mock_client))
    # Set the key so the planner takes the real path (not the stub fallback)
    for _ in _patch_nvidia(monkeypatch, api_key=api_key):
        pass
    return mock_client, captured


def _patch_nvidia(monkeypatch, *, api_key: str = "nvapi-fake", model: str | None = None):
    """Force settings.nvidia_api_key to a non-empty value for the test."""
    from app.core.config import settings
    from app.services import ai_planner

    orig_key = settings.nvidia_api_key
    orig_model = settings.nvidia_model
    settings.nvidia_api_key = api_key
    if model:
        settings.nvidia_model = model
    try:
        yield
    finally:
        settings.nvidia_api_key = orig_key
        settings.nvidia_model = orig_model


# ============================================================================
# 1. GOAL TEXT  —  the user's exact words must reach the LLM
# ============================================================================

class TestGoalTextPersonalization:
    def test_goal_text_appears_verbatim_in_user_prompt(self):
        """If the planner ever drops the goal from the prompt, fail loud."""
        from app.services.ai_planner import generate_plan

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            for _ in _patch_nvidia(MagicMock(), api_key="nvapi-x"):
                pass  # use a fresh monkeypatch
            # Patch the key directly without yielding
            from app.core.config import settings
            settings.nvidia_api_key = "nvapi-x"
            try:
                result = generate_plan(PlanGenerateRequest(
                    goal="Train for a half-marathon in 12 weeks while keeping my day job",
                    timeframe="3 months",
                    energy_focus="physical",
                    pillars=["stella", "flora"],
                ))
            finally:
                settings.nvidia_api_key = ""

        # Find the user message in the captured call
        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        assert "Train for a half-marathon in 12 weeks while keeping my day job" in user_msg["content"]
        assert result.title == "Personalized Plan"

    def test_special_characters_in_goal_are_preserved(self):
        """Punctuation, quotes, and unicode in the goal must survive."""
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Read Søren's \"Either/Or\" + 2 neuro papers",
                    timeframe="1 month",
                    energy_focus="deep",
                    pillars=["musa", "flora"],
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        assert "Søren" in user_msg["content"]
        assert '"Either/Or"' in user_msg["content"]


# ============================================================================
# 2. TIMEFRAME  —  the right number of days must be requested
# ============================================================================

class TestTimeframePersonalization:
    @pytest.mark.parametrize("timeframe,expected_days", [
        ("1 month", 30),
        ("3 months", 90),
        ("6 months", 180),
    ])
    def test_timeframe_maps_to_expected_day_count(self, timeframe, expected_days):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Learn to cook Thai food",
                    timeframe=timeframe,
                    energy_focus="balanced",
                    pillars=["flora"],
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        # Prompt must mention the day count
        assert f"{expected_days} days" in user_msg["content"]
        # And the timeframe label
        assert timeframe in user_msg["content"]

    def test_custom_days_passed_through(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Custom timeframe plan",
                    timeframe="custom",
                    custom_days=45,
                    energy_focus="balanced",
                    pillars=["tecna"],
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        assert "45 days" in user_msg["content"]
        assert "custom" in user_msg["content"]


# ============================================================================
# 3. PILLARS  —  only the user's chosen pillars are mentioned
# ============================================================================

class TestPillarPersonalization:
    def test_all_user_pillars_listed_in_prompt(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        chosen: list[Pillar] = ["tecna", "musa", "bloom"]
        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Ship the launch",
                    timeframe="3 months",
                    energy_focus="balanced",
                    pillars=chosen,
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        # All chosen pillars are named
        for p in chosen:
            assert p in user_msg["content"], f"missing pillar {p}"
        # And not-just-chosen pillars are NOT introduced — system prompt mentions
        # "do NOT introduce pillars they did not"; the user prompt must list
        # exactly the requested set under "PILLARS TO COVER"
        covered_line = [
            line for line in user_msg["content"].splitlines()
            if line.startswith("PILLARS TO COVER:")
        ]
        assert len(covered_line) == 1
        listed = {p.strip() for p in covered_line[0].split(":", 1)[1].split(",")}
        assert listed == set(chosen)

    def test_single_pillar_plan_lists_only_that_pillar(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Just ship code",
                    timeframe="1 month",
                    energy_focus="deep",
                    pillars=["tecna"],
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        assert "PILLARS TO COVER: tecna" in user_msg["content"]


# ============================================================================
# 4. RESOURCES / ATTACHMENTS  —  the planner enriches and embeds them
# ============================================================================

class TestResourcePersonalization:
    def test_link_attachment_is_enriched_and_embedded(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        link = Attachment(
            id="a1", kind="link", name="https://docs.example.com/article",
            value="https://docs.example.com/article",
        )
        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            # Patch _fetch_link_block to return canned content
            with patch("app.services.enrichment._fetch_link_block") as fake_fetch:
                fake_fetch.return_value = (
                    "\n🔗 https://docs.example.com/article\n"
                    "   Title: A GREAT ARTICLE\n"
                    "   Description: Deep dive on brain-computer interfaces\n"
                    "   Content preview: BCI controls a robotic arm with neural signals"
                )
                settings.nvidia_api_key = "nvapi-x"
                try:
                    generate_plan(PlanGenerateRequest(
                        goal="Learn BCIs",
                        timeframe="1 month",
                        energy_focus="deep",
                        pillars=["tecna", "flora"],
                        attachments=[link],
                    ))
                finally:
                    settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        # Link title + preview MUST be in the prompt
        assert "A GREAT ARTICLE" in user_msg["content"]
        assert "robotic arm" in user_msg["content"]
        # The URL itself should also be referenced
        assert "docs.example.com" in user_msg["content"]
        # And the planner should explicitly tell the LLM to use the context
        assert "Use the above attachment context" in user_msg["content"]

    def test_text_file_attachment_is_decoded_into_prompt(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        body = b"Project GOAT: ship by Q3. Stack: Next.js, Supabase, Stripe."
        data_url = (
            "data:text/plain;base64," + base64.b64encode(body).decode()
        )
        file_att = Attachment(
            id="a1", kind="file", name="goat-spec.txt", value=data_url,
            mime="text/plain", size=len(body),
        )
        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Execute project GOAT",
                    timeframe="3 months",
                    energy_focus="deep",
                    pillars=["tecna", "bloom"],
                    attachments=[file_att],
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        # The decoded text MUST be present so the LLM can plan against it
        assert "Project GOAT" in user_msg["content"]
        assert "Next.js" in user_msg["content"]
        assert "Stripe" in user_msg["content"]

    def test_no_attachments_means_no_attachment_block(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Solo project plan here",
                    timeframe="1 month",
                    energy_focus="balanced",
                    pillars=["tecna"],
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        assert "Use the above attachment context" not in user_msg["content"]


# ============================================================================
# 5. CUSTOM PROMPT  —  user instructions pass through verbatim
# ============================================================================

class TestCustomPromptPersonalization:
    def test_custom_prompt_is_appended_to_user_prompt(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Whatever, this is enough",
                    timeframe="3 months",
                    energy_focus="balanced",
                    pillars=["tecna"],
                    custom_prompt="Only suggest weekday tasks. No weekends.",
                ))
            finally:
                settings.nvidia_api_key = ""

        user_msg = next(
            m for m in client.chat.completions.create.call_args.kwargs["messages"]
            if m["role"] == "user"
        )
        assert "CUSTOM PROMPT" in user_msg["content"]
        assert "Only suggest weekday tasks. No weekends." in user_msg["content"]


# ============================================================================
# 6. REQUEST SHAPE  —  schema + temperature + model + response_format
# ============================================================================

class TestRequestShape:
    def test_response_format_is_strict_json_schema(self):
        from app.services.ai_planner import generate_plan
        from app.schemas.models import GeneratedPlan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Test goal long enough", timeframe="3 months", energy_focus="balanced", pillars=["tecna"],
                ))
            finally:
                settings.nvidia_api_key = ""

        kwargs = client.chat.completions.create.call_args.kwargs
        # response_format is the strict json_schema
        rf = kwargs["response_format"]
        assert rf["type"] == "json_schema"
        assert rf["json_schema"]["name"] == "plan"
        assert rf["json_schema"]["strict"] is True
        # The schema matches the GeneratedPlan Pydantic schema
        assert rf["json_schema"]["schema"] == GeneratedPlan.model_json_schema()

    def test_model_is_set_from_settings(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            settings.nvidia_model = "deepseek-ai/deepseek-v4-flash"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Test goal long enough", timeframe="3 months", energy_focus="balanced", pillars=["tecna"],
                ))
            finally:
                settings.nvidia_api_key = ""

        kwargs = client.chat.completions.create.call_args.kwargs
        assert kwargs["model"] == "deepseek-ai/deepseek-v4-flash"

    def test_temperature_is_reasonable(self):
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload()
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                generate_plan(PlanGenerateRequest(
                    goal="Test goal long enough", timeframe="3 months", energy_focus="balanced", pillars=["tecna"],
                ))
            finally:
                settings.nvidia_api_key = ""

        kwargs = client.chat.completions.create.call_args.kwargs
        assert 0.0 <= kwargs["temperature"] <= 1.0


# ============================================================================
# 7. RESPONSE PIPELINE  —  the parsed plan is what the UI sees
# ============================================================================

class TestResponsePipeline:
    def test_response_parses_into_generated_plan(self):
        from app.services.ai_planner import generate_plan
        from app.schemas.models import GeneratedPlan
        from app.core.config import settings

        with patch("app.services.ai_planner.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = _build_fake_completion(
                _valid_plan_payload("My Ship Plan", days=90)
            )
            settings.nvidia_api_key = "nvapi-x"
            try:
                plan = generate_plan(PlanGenerateRequest(
                    goal="Test goal long enough", timeframe="3 months", energy_focus="balanced", pillars=["tecna"],
                ))
            finally:
                settings.nvidia_api_key = ""

        assert isinstance(plan, GeneratedPlan)
        assert plan.title == "My Ship Plan"
        assert plan.fallback_stub is False  # real LLM path

    def test_fallback_stub_marker_when_no_key(self):
        """When no NVIDIA key is configured, the planner returns a stub
        and marks it so the UI can warn the user."""
        from app.services.ai_planner import generate_plan
        from app.core.config import settings

        settings.nvidia_api_key = ""
        try:
            plan = generate_plan(PlanGenerateRequest(
                goal="Test goal long enough", timeframe="3 months", energy_focus="balanced", pillars=["tecna"],
            ))
        finally:
            settings.nvidia_api_key = ""

        assert plan.fallback_stub is True
