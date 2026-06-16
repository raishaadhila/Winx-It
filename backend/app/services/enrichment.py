"""
Attachment enrichment — fetch link content + extract text from uploaded files
so the AI planner has real context to personalize the quest.

The DeepSeek model on NVIDIA NIM has no vision tool, so images are passed
through as filename + metadata only. Links are fetched (HTML, title, meta
description, first 1500 chars of stripped text). Text files are
base64-decoded and included as a preview (first 2000 chars).

All enrichment is bounded so a user uploading many large files can't blow
up the prompt. On any failure we fall back to the bare attachment name —
the planner never breaks because of enrichment errors.
"""
from __future__ import annotations

import base64
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import unquote

import httpx

from app.schemas.models import Attachment

logger = logging.getLogger(__name__)

MAX_LINKS_FETCHED = 3
MAX_TEXT_FILES = 3
MAX_PREVIEW_CHARS = 2000
HTTP_TIMEOUT_SECS = 8.0

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_META_DESC_RE = re.compile(
    r"""<meta[^>]*?
        (?:name\s*=\s*["']description["']|property\s*=\s*["']og:description["'])
        [^>]*?content\s*=\s*["']([^"']*)["']""",
    re.IGNORECASE | re.VERBOSE,
)
_META_OG_TITLE_RE = re.compile(
    r"""<meta[^>]*?property\s*=\s*["']og:title["'][^>]*?content\s*=\s*["']([^"']*)["']""",
    re.IGNORECASE | re.VERBOSE,
)
_SCRIPT_STYLE_RE = re.compile(
    r"<(script|style|nav|header|footer|noscript)[^>]*>.*?</\1>",
    re.IGNORECASE | re.DOTALL,
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")
_DATA_URL_RE = re.compile(r"^data:([^;,]*?)(?:;base64)?,(.*)$", re.DOTALL)


def enrich_attachments(attachments: list[Attachment] | None) -> str:
    """Return a plain-text block describing each attachment with as much
    real content as we can pull in. Empty string if no attachments."""
    if not attachments:
        return ""

    blocks: list[str] = ["\nADDITIONAL CONTEXT FROM YOUR ATTACHMENTS:"]

    # Split by kind; fetch links in parallel, process files inline.
    links = [a for a in attachments if a.kind == "link"][:MAX_LINKS_FETCHED]
    files = [a for a in attachments if a.kind == "file"][:MAX_TEXT_FILES]
    images = [a for a in attachments if a.kind == "image"]

    if links:
        with ThreadPoolExecutor(max_workers=min(4, len(links))) as ex:
            futures = {ex.submit(_fetch_link_block, a): a for a in links}
            for fut in futures:
                att = futures[fut]
                try:
                    blocks.append(fut.result(timeout=HTTP_TIMEOUT_SECS + 2))
                except Exception as e:
                    logger.warning("link enrich failed for %s: %s", att.name, e)
                    blocks.append(f"\n🔗 {att.name} (could not fetch: {e})")

    for att in files:
        text = _extract_text_from_data_url(att.value)
        mime = (att.mime or "").lower()
        if text:
            preview = text[:MAX_PREVIEW_CHARS]
            tail = "\n   …" if len(text) > MAX_PREVIEW_CHARS else ""
            blocks.append(
                f"\n📄 {att.name} ({att.mime or 'text file'}):\n{preview}{tail}"
            )
        elif mime.startswith("text/") or mime in {"application/json"}:
            blocks.append(f"\n📄 {att.name} ({att.mime or 'file'}) — no readable text")
        else:
            blocks.append(
                f"\n📄 {att.name} ({att.mime or 'binary file'}, "
                f"{(att.size or 0) // 1024} KB) — binary, content not extracted"
            )

    for att in images:
        size_kb = (att.size or 0) // 1024
        blocks.append(
            f"\n🖼️ {att.name} ({att.mime or 'image'}, {size_kb} KB) — "
            f"image content not viewable by this model; only filename + metadata available"
        )

    if len(attachments) > len(links) + len(files) + len(images):
        blocks.append(
            f"\n(…plus {len(attachments) - len(links) - len(files) - len(images)} more attachment(s) omitted)"
        )

    return "\n".join(blocks)


# ---------- internals ----------

def _fetch_link_block(att: Attachment) -> str:
    try:
        with httpx.Client(
            timeout=HTTP_TIMEOUT_SECS,
            follow_redirects=True,
            headers={"User-Agent": "WinxIt-QuestCaster/1.0"},
        ) as client:
            r = client.get(att.value)
    except Exception as e:
        return f"\n🔗 {att.name} (fetch failed: {e})"

    if r.status_code >= 400:
        return f"\n🔗 {att.name} (fetch failed: HTTP {r.status_code})"

    html = r.text or ""
    title = _clean(_first(_META_OG_TITLE_RE, html) or _first(_TITLE_RE, html))
    desc = _clean(_first(_META_DESC_RE, html))

    # Strip scripts/styles/nav, then tags, then collapse whitespace
    body = _SCRIPT_STYLE_RE.sub(" ", html)
    body = _HTML_TAG_RE.sub(" ", body)
    body = _WHITESPACE_RE.sub(" ", body).strip()
    preview = body[:1500]
    tail = " …" if len(body) > 1500 else ""

    out = [f"\n🔗 {att.name}"]
    if title:
        out.append(f"   Title: {title[:200]}")
    if desc:
        out.append(f"   Description: {desc[:400]}")
    if preview:
        out.append(f"   Content preview: {preview}{tail}")
    if not (title or desc or preview):
        out.append("   (no readable content extracted)")
    return "\n".join(out)


def _first(pattern: re.Pattern[str], haystack: str) -> str:
    m = pattern.search(haystack)
    return m.group(1) if m else ""


def _clean(text: str) -> str:
    return _WHITESPACE_RE.sub(" ", text).strip()


# Pre-compile the whitespace regex for _clean
_WHITESPACE_RE = re.compile(r"\s+")


def _extract_text_from_data_url(data_url: str) -> str:
    """Decode a data: URL into text. Returns '' for binary/unreadable."""
    if not data_url.startswith("data:"):
        return ""
    m = _DATA_URL_RE.match(data_url)
    if not m:
        return ""
    _, payload = m.group(1), m.group(2)
    try:
        if ";base64" in data_url:
            raw = base64.b64decode(payload)
        else:
            raw = unquote(payload).encode("utf-8")
        return raw.decode("utf-8", errors="ignore")
    except Exception:
        return ""
