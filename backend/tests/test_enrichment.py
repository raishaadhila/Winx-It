"""TDD: attachment enrichment.

The AI planner's personalization works only if enrichment actually
extracts content from the user's links and text files. These tests
cover the extraction logic in isolation, plus its integration into
the planner's prompt building.
"""
from unittest.mock import patch, MagicMock

import pytest

from app.schemas.models import Attachment
from app.services.enrichment import (
    _extract_text_from_data_url,
    _fetch_link_block,
    enrich_attachments,
)


# ---------- _extract_text_from_data_url ----------

class TestExtractText:
    def test_plain_text_data_url(self):
        url = "data:text/plain;base64," + __import__("base64").b64encode(b"hello world").decode()
        assert _extract_text_from_data_url(url) == "hello world"

    def test_markdown_data_url(self):
        body = "# Title\n\nSome **bold** text."
        import base64
        url = "data:text/markdown;base64," + base64.b64encode(body.encode()).decode()
        out = _extract_text_from_data_url(url)
        assert "# Title" in out
        assert "**bold**" in out

    def test_json_data_url(self):
        body = '{"key": "value"}'
        import base64
        url = "data:application/json;base64," + base64.b64encode(body.encode()).decode()
        assert _extract_text_from_data_url(url) == body

    def test_non_data_url_returns_empty(self):
        assert _extract_text_from_data_url("https://example.com") == ""

    def test_empty_string_returns_empty(self):
        assert _extract_text_from_data_url("") == ""

    def test_malformed_data_url_returns_empty(self):
        assert _extract_text_from_data_url("data:garbage") == ""


# ---------- _fetch_link_block ----------

class TestFetchLink:
    def test_fetches_title_description_and_preview(self):
        html = """
        <html>
          <head>
            <title>  My Article Title  </title>
            <meta name="description" content="A short description of the article.">
          </head>
          <body>
            <script>var x = 1;</script>
            <style>body { color: red; }</style>
            <h1>Visible</h1>
            <p>This is the first paragraph.</p>
            <p>This is the second paragraph with more text.</p>
          </body>
        </html>
        """
        fake_resp = MagicMock()
        fake_resp.status_code = 200
        fake_resp.text = html

        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            att = Attachment(id="1", kind="link", name="https://x.io", value="https://x.io")
            out = _fetch_link_block(att)

        assert "My Article Title" in out
        assert "A short description" in out
        assert "Visible" in out
        assert "first paragraph" in out
        # Strip out script/style content
        assert "var x = 1" not in out
        assert "color: red" not in out

    def test_handles_404(self):
        fake_resp = MagicMock()
        fake_resp.status_code = 404
        fake_resp.text = ""

        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            att = Attachment(id="1", kind="link", name="https://x.io", value="https://x.io")
            out = _fetch_link_block(att)

        assert "404" in out
        assert "fetch failed" in out

    def test_handles_network_error(self):
        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.side_effect = ConnectionError("boom")
            att = Attachment(id="1", kind="link", name="https://x.io", value="https://x.io")
            out = _fetch_link_block(att)

        assert "boom" in out

    def test_prefers_og_title_over_html_title(self):
        html = """
        <html>
          <head>
            <title>HTML Title</title>
            <meta property="og:title" content="OG Title">
          </head>
          <body><p>body</p></body>
        </html>
        """
        fake_resp = MagicMock()
        fake_resp.status_code = 200
        fake_resp.text = html

        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            att = Attachment(id="1", kind="link", name="x", value="https://x.io")
            out = _fetch_link_block(att)

        # The Title: line must use the og:title
        assert "Title: OG Title" in out
        assert "Title: HTML Title" not in out

    def test_truncates_long_preview(self):
        body = "x" * 5000
        html = f"<html><body><p>{body}</p></body></html>"
        fake_resp = MagicMock()
        fake_resp.status_code = 200
        fake_resp.text = html

        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            att = Attachment(id="1", kind="link", name="x", value="https://x.io")
            out = _fetch_link_block(att)

        # Preview is truncated with an ellipsis
        assert "…" in out
        # The truncated part shouldn't include all 5000 x's
        assert body not in out


# ---------- enrich_attachments ----------

class TestEnrichAttachments:
    def test_empty_returns_empty_string(self):
        assert enrich_attachments(None) == ""
        assert enrich_attachments([]) == ""

    def test_only_text_file_no_link(self):
        import base64
        url = "data:text/plain;base64," + base64.b64encode(b"my spec text").decode()
        att = Attachment(id="1", kind="file", name="spec.md",
                        value=url, mime="text/markdown")
        out = enrich_attachments([att])
        assert "📄" in out
        assert "spec.md" in out
        assert "my spec text" in out

    def test_image_attachment(self):
        att = Attachment(id="1", kind="image", name="diagram.png",
                        value="data:...", mime="image/png", size=2048)
        out = enrich_attachments([att])
        assert "🖼️" in out
        assert "diagram.png" in out
        assert "image/png" in out
        assert "2 KB" in out  # 2048 bytes

    def test_link_uses_fetcher(self):
        html = "<html><head><title>Hello</title></head><body><p>Body</p></body></html>"
        fake_resp = MagicMock()
        fake_resp.status_code = 200
        fake_resp.text = html

        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            att = Attachment(id="1", kind="link", name="x", value="https://x.io")
            out = enrich_attachments([att])

        assert "🔗" in out
        assert "Hello" in out
        assert "Body" in out

    def test_caps_links_at_max(self):
        # 5 links provided, only MAX_LINKS_FETCHED (3) should be fetched
        atts = [
            Attachment(id=str(i), kind="link", name=f"link{i}", value=f"https://x.io/{i}")
            for i in range(5)
        ]
        fake_resp = MagicMock()
        fake_resp.status_code = 200
        fake_resp.text = "<html><body>hi</body></html>"

        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            out = enrich_attachments(atts)

        # The "(…plus N more attachment(s) omitted)" line should appear
        assert "omitted" in out

    def test_failed_link_falls_back_to_bare_name(self):
        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.side_effect = ConnectionError("nope")
            att = Attachment(id="1", kind="link", name="https://x.io", value="https://x.io")
            out = enrich_attachments([att])

        # The bare URL still appears, plus a note about the failure
        assert "https://x.io" in out
        assert "nope" in out


# ---------- integration with the planner prompt ----------

class TestPromptBuilderIntegration:
    def test_user_prompt_includes_enriched_link_content(self):
        from app.schemas.models import PlanGenerateRequest
        from app.services.ai_planner import _user_prompt

        req = PlanGenerateRequest(
            goal="Build my SaaS",
            timeframe="1 month",
            energy_focus="balanced",
            pillars=["tecna"],
            attachments=[
                Attachment(id="1", kind="link", name="https://myblog.io",
                           value="https://myblog.io"),
            ],
        )
        html = "<html><head><title>My Blog Post</title></head><body><p>Some text</p></body></html>"
        fake_resp = MagicMock()
        fake_resp.status_code = 200
        fake_resp.text = html

        with patch("app.services.enrichment.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = fake_resp
            prompt = _user_prompt(req, days=30)

        # The link's title and content should be in the prompt, not just the URL
        assert "My Blog Post" in prompt
        assert "Some text" in prompt
        # The personalization hint should be included
        assert "specific to the user's actual situation" in prompt

    def test_user_prompt_includes_extracted_file_text(self):
        from app.schemas.models import PlanGenerateRequest
        from app.services.ai_planner import _user_prompt
        import base64

        body = "We need to ship the dashboard by Friday."
        url = "data:text/plain;base64," + base64.b64encode(body.encode()).decode()
        req = PlanGenerateRequest(
            goal="Plan the entire Q4 roadmap",
            timeframe="3 months",
            energy_focus="balanced",
            pillars=["bloom"],
            attachments=[Attachment(id="1", kind="file", name="notes.txt",
                                   value=url, mime="text/plain")],
        )
        prompt = _user_prompt(req, days=90)

        # The extracted text should be in the prompt
        assert "ship the dashboard by Friday" in prompt

    def test_generated_plan_uses_attachment_context_end_to_end(self):
        """Smoke test: a full call with attachments and mocked LLM should
        pass attachment content through the OpenAI client's prompt arg."""
        from app.schemas.models import PlanGenerateRequest
        from app.services import ai_planner
        import base64

        body = "My secret project codename: Phoenix."
        url = "data:text/plain;base64," + base64.b64encode(body.encode()).decode()

        req = PlanGenerateRequest(
            goal="Build a thing",
            timeframe="1 month",
            energy_focus="balanced",
            pillars=["tecna"],
            attachments=[Attachment(id="1", kind="file", name="brief.txt",
                                   value=url, mime="text/plain")],
        )

        captured = {}
        def fake(*args, **kwargs):
            captured["prompt"] = kwargs["messages"][1]["content"]
            msg = MagicMock(); msg.content = '{"title":"X","start_date":"2026-06-16","end_date":"2026-06-16","tasks":[]}'
            choice = MagicMock(); choice.message = msg
            resp = MagicMock(); resp.choices = [choice]
            return resp

        with patch.object(ai_planner, "OpenAI") as MockOpenAI, \
             patch.object(ai_planner.settings, "nvidia_api_key", "nvapi-test"):
            MockOpenAI.return_value.chat.completions.create.side_effect = fake
            ai_planner.generate_plan(req)

        # The file's secret content should have made it to the LLM
        assert "Phoenix" in captured["prompt"]
