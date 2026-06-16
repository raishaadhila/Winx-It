"""TDD: new PlanGenerateRequest fields — attachments + custom_prompt.

The AI planner now accepts user attachments (files, images, links) and an
optional custom_prompt column. This test locks in the schema contract.
"""
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from app.schemas.models import PlanGenerateRequest


def _base():
    return {
        "goal": "Build something cool",
        "timeframe": "3 months",
        "energy_focus": "balanced",
        "pillars": ["tecna", "bloom"],
    }


class TestAttachments:
    def test_omitting_attachments_is_valid(self):
        req = PlanGenerateRequest(**_base())
        assert req.attachments is None

    def test_empty_attachments_list_is_valid(self):
        req = PlanGenerateRequest(**_base(), attachments=[])
        assert req.attachments == []

    def test_link_attachment(self):
        att = {"id": "1", "kind": "link", "name": "https://x.io/a", "value": "https://x.io/a"}
        req = PlanGenerateRequest(**_base(), attachments=[att])
        assert req.attachments[0].kind == "link"
        assert req.attachments[0].value == "https://x.io/a"

    def test_image_attachment_with_size(self):
        att = {
            "id": "1", "kind": "image", "name": "diagram.png",
            "value": "data:image/png;base64,XXX", "size": 12345, "mime": "image/png",
        }
        req = PlanGenerateRequest(**_base(), attachments=[att])
        assert req.attachments[0].size == 12345
        assert req.attachments[0].mime == "image/png"

    def test_file_attachment(self):
        att = {"id": "1", "kind": "file", "name": "spec.pdf", "value": "data:..."}
        req = PlanGenerateRequest(**_base(), attachments=[att])
        assert req.attachments[0].kind == "file"

    @pytest.mark.parametrize("bad_kind", ["video", "audio", "url", "other"])
    def test_invalid_kind_rejected(self, bad_kind):
        with pytest.raises(ValidationError):
            PlanGenerateRequest(
                **_base(),
                attachments=[{"id": "1", "kind": bad_kind, "name": "x", "value": "x"}],
            )


class TestCustomPrompt:
    def test_omitting_custom_prompt_is_valid(self):
        req = PlanGenerateRequest(**_base())
        assert req.custom_prompt is None

    def test_short_custom_prompt_ok(self):
        req = PlanGenerateRequest(**_base(), custom_prompt="Use metric units")
        assert req.custom_prompt == "Use metric units"

    def test_overly_long_custom_prompt_rejected(self):
        with pytest.raises(ValidationError):
            PlanGenerateRequest(**_base(), custom_prompt="x" * 5000)

    def test_combined_with_attachments(self):
        att = {"id": "1", "kind": "link", "name": "x", "value": "x"}
        req = PlanGenerateRequest(
            **_base(),
            attachments=[att],
            custom_prompt="focus on weekdays",
        )
        assert req.attachments is not None
        assert req.custom_prompt is not None


class TestUserPromptBuilding:
    """The planner's _user_prompt should include attachments + custom_prompt."""

    def test_includes_attachments_section_when_present(self):
        from app.services.ai_planner import _user_prompt

        req = PlanGenerateRequest(
            **_base(),
            attachments=[{"id": "1", "kind": "link", "name": "https://x.io", "value": "https://x.io"}],
        )
        # Mock the link fetcher so we don't hit the real network
        fake_resp = MagicMock(); fake_resp.status_code = 200; fake_resp.text = "<html></html>"
        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            prompt = _user_prompt(req, days=30)

        assert "ATTACHMENTS" in prompt
        assert "https://x.io" in prompt

    def test_includes_custom_prompt_when_present(self):
        from app.services.ai_planner import _user_prompt

        req = PlanGenerateRequest(**_base(), custom_prompt="Use metric units only")
        prompt = _user_prompt(req, days=30)
        assert "CUSTOM PROMPT" in prompt
        assert "Use metric units only" in prompt

    def test_omits_attachments_section_when_absent(self):
        from app.services.ai_planner import _user_prompt

        req = PlanGenerateRequest(**_base())
        prompt = _user_prompt(req, days=30)
        assert "ATTACHMENTS" not in prompt
        assert "CUSTOM PROMPT" not in prompt
