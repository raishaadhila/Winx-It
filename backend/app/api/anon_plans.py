"""Public, no-auth plan-generation endpoint.

A brand-new visitor can generate a personalized quest without signing up.
The plan is returned in the response — we don't touch Supabase on their
behalf. If they want their plan + XP to sync to the cloud, they sign up;
the local plans are then transferred to the authed /api/plans endpoint.

Rate-limited to 5 calls per 10 minutes per IP so this can't be used as a
free proxy. No user data is stored server-side.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from openai import OpenAI

from app.core.config import settings
from app.limiter import anon_plans_limiter
from app.schemas.models import GeneratedPlan, PlanGenerateRequest
from app.services.ai_planner import _user_prompt, _days_for


def _enforce_anon_rate_limit(request: Request) -> None:
    """FastAPI dependency: 5 anon plan generations per 10 minutes per IP.

    In-memory sliding window. Plenty for our scale; no extra deps.
    """
    client_ip = request.client.host if request.client else "unknown"
    if not anon_plans_limiter.check(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded: 5 plans per 10 minutes. Sign up for unlimited access.",
        )

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/anon", tags=["anon"])


# Public alias for the LLM call. Tests mock this; we keep the heavy
# OpenAI/NVIDIA plumbing in one place so it's easy to swap providers.
def _call_llm(req: PlanGenerateRequest) -> GeneratedPlan:
    days = _days_for(req)
    if not settings.nvidia_api_key:
        raise RuntimeError("LLM not configured: NVIDIA_API_KEY is missing on the server")

    client = OpenAI(api_key=settings.nvidia_api_key, base_url=settings.nvidia_base_url)
    schema = GeneratedPlan.model_json_schema()

    completion = client.chat.completions.create(
        model=settings.nvidia_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(req, days)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "plan", "schema": schema, "strict": True},
        },
        temperature=0.7,
    )

    raw = completion.choices[0].message.content
    if not raw:
        raise ValueError("LLM returned an empty response")

    data = json.loads(raw)
    return GeneratedPlan.model_validate(data)


# Kept here (not in ai_planner) so anon generation is one round-trip without
# touching any persistent store.
_SYSTEM_PROMPT = """\
You are Winx It!'s quest architect. You transform a free-form personal goal
into a structured, day-by-day action plan a Type A user can execute.

Rules:
- Spread tasks across the timeframe. No crunch days, no dead days.
- Group tasks by day (multiple tasks per day are OK).
- Use the user's GOAL text and the ADDITIONAL CONTEXT FROM YOUR ATTACHMENTS
  as the primary personalization signal. Reference concrete details —
  specific tools, topics, names, numbers, and resources they mentioned.
  Do NOT generate generic pillar templates; the plan must feel like it was
  written for THIS user's specific situation.
- Timeframe-aware difficulty:
    * 1 month  -> dense, focused, no ramp-up day
    * 3 months -> 1-week ramp-up, 1-week plateau, 1-week consolidation
    * 6 months -> 2-week ramp-up, 3-week core, 2-week consolidation
- Weekly checkpoint: the LAST task of each week is a challenge / self-test
  that uses what the user learned that week. Examples by pillar:
    * tecna  -> ship a tiny artifact, debug a real example, build + run
    * flora  -> apply a concept to a real situation, journal a reflection
    * musa   -> speak / write / present something produced from the week
    * bloom  -> publish, share with one real person, gather one response
    * stella -> do a physical benchmark, compare against last week
  The checkpoint description should name the deliverable, not "review".
- Mix pillars the user asked for; do NOT introduce pillars they did not.
- Energy levels:
    * "low"    -> routine, 30-60 min, low cognitive load
    * "medium" -> focused work, 1-2 hrs, normal cognitive load
    * "high"   -> deep work, 2-4 hrs, requires full focus
- Each task description: short, imperative, 4-10 words. Name the artifact.
- Cap 8h working, 1h physical per day.
- Output must be valid JSON matching the schema exactly. No prose.
"""


@router.post("/plans/generate", response_model=GeneratedPlan,
             dependencies=[Depends(_enforce_anon_rate_limit)])
def generate_anon_plan(req: PlanGenerateRequest, request: Request):
    """Generate a personalized quest. No auth required. Rate-limited."""
    try:
        return _call_llm(req)
    except RuntimeError as e:
        # LLM not configured on server
        logger.error("anon plan generation failed (no key): %s", e)
        raise HTTPException(status_code=503, detail=f"LLM not available: {e}")
    except (ValueError, json.JSONDecodeError) as e:
        # LLM returned something we couldn't parse
        logger.error("anon plan generation failed (parse): %s", e)
        raise HTTPException(status_code=502, detail=f"LLM returned invalid output: {e}")
    except Exception as e:
        logger.exception("anon plan generation failed (unknown)")
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")
