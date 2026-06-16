"""
AI plan-generation service.

Uses OpenAI's Python SDK pointed at the NVIDIA NIM endpoint
(OpenAI-compatible). The model is `deepseek-ai/deepseek-v4-flash` served
via https://integrate.api.nvidia.com/v1.

The planner is what makes Winx It! personalized: before calling the LLM,
it enriches any user attachments (fetches link content, extracts text
from uploaded files) so the generated plan reflects the user's real
context — not just the goal string.
"""
from __future__ import annotations

import json
from datetime import date, timedelta

from openai import OpenAI

from app.core.config import settings
from app.schemas.models import GeneratedPlan, PlanGenerateRequest, Pillar
from app.services.enrichment import enrich_attachments

SYSTEM_PROMPT = """\
You are Winx It!'s quest architect. You transform a free-form personal goal
into a structured, day-by-day action plan a Type A user can execute.

Rules:
- The user's GOAL text and the ADDITIONAL CONTEXT FROM YOUR ATTACHMENTS
  are the primary personalization signal. Reference concrete details —
  specific tools, topics, names, numbers, and resources they mentioned.
  Do NOT generate generic pillar templates; the plan must feel like it was
  written for THIS user's specific situation.
- Spread tasks across the timeframe. No crunch days, no dead days.
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
  - "low"     -> routine, 30-60 min, low cognitive load
  - "medium"  -> focused work, 1-2 hrs, normal cognitive load
  - "high"    -> deep work, 2-4 hrs, requires full focus
- Each task description: short, imperative, 4-10 words. Name the artifact.
- Group tasks by day (multiple tasks per day are OK).
- Reasonable hours per day (cap 8h working, 1h physical).
- Output must be valid JSON matching the schema exactly. No prose.
"""


def _user_prompt(req: PlanGenerateRequest, days: int) -> str:
    pillars = ", ".join(req.pillars)
    parts: list[str] = [
        f"GOAL: {req.goal}",
        f"TIMEFRAME: {req.timeframe} ({days} days, starting {date.today().isoformat()})",
        f"ENERGY FOCUS: {req.energy_focus}",
        f"PILLARS TO COVER: {pillars}",
    ]
    if req.attachments:
        # This is the personalization step: we actually fetch the links and
        # extract the text from files so the LLM has real context to use.
        parts.append(enrich_attachments(req.attachments))
        parts.append(
            "\nUse the above attachment context to make the plan specific "
            "to the user's actual situation — reference concrete details "
            "from links/files when relevant, and tailor task descriptions "
            "to the tools, topics, and people mentioned."
        )
    if req.custom_prompt:
        parts.append(f"\nCUSTOM PROMPT (extra instructions from the user):\n{req.custom_prompt}")
    parts.append(
        f"\nGenerate a complete {days}-day quest plan. Each task must include day, week, "
        f"month, date, description, pillar, hours, energy."
    )
    return "\n".join(parts)


def _days_for(req: PlanGenerateRequest) -> int:
    if req.timeframe == "1 month":
        return 30
    if req.timeframe == "3 months":
        return 90
    if req.timeframe == "6 months":
        return 180
    if req.custom_days:
        return min(req.custom_days, 365)
    return 90


def generate_plan(req: PlanGenerateRequest) -> GeneratedPlan:
    days = _days_for(req)
    start = date.today()

    if not settings.nvidia_api_key:
        # Dev fallback: produce a small but realistic stub so the UI flows
        # when the operator hasn't set NVIDIA_API_KEY yet.
        return _stub_plan(req, start, days)

    # OpenAI-compatible client pointed at the NVIDIA NIM endpoint.
    client = OpenAI(
        api_key=settings.nvidia_api_key,
        base_url=settings.nvidia_base_url,
    )
    schema = GeneratedPlan.model_json_schema()

    completion = client.chat.completions.create(
        model=settings.nvidia_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(req, days)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "plan", "schema": schema, "strict": True},
        },
        temperature=0.7,
    )

    raw = completion.choices[0].message.content
    data = json.loads(raw)
    return GeneratedPlan.model_validate(data)


def _stub_plan(req: PlanGenerateRequest, start: date, days: int) -> GeneratedPlan:
    pillars: list[Pillar] = req.pillars or ["tecna", "flora"]
    title_seed = req.goal.strip().split(".")[0][:60].title() or "New Quest"
    tasks: list[dict] = []
    for d in range(1, min(days, 21) + 1):  # stub caps at 3 weeks
        pillar = pillars[(d - 1) % len(pillars)]
        hours = 1.5 if d % 2 else 0.5
        energy = "high" if d % 5 == 0 else "medium" if d % 2 else "low"
        descs = {
            "tecna": ["Ship a feature", "Review PRs", "Refactor module", "Run benchmarks"],
            "flora": ["Read research module", "Cardio session", "Stretch + breathe", "Brain imaging notes"],
            "musa": ["Read English journal", "Listen to podcast", "Write summary", "Vocab drill"],
            "bloom": ["Outreach sequence", "Ship launch update", "User interview", "Marketing post"],
            "stella": ["Cycle 30min", "Swim laps", "Meditate 10min", "Walk + reflect"],
        }
        tasks.append({
            "day": d,
            "week": (d - 1) // 7 + 1,
            "month": (d - 1) // 30 + 1,
            "date": (start + timedelta(days=d - 1)).isoformat(),
            "description": descs[pillar][(d - 1) % 4],
            "pillar": pillar,
            "hours": hours,
            "energy": energy,
        })
    return GeneratedPlan(
        title=title_seed,
        start_date=start,
        end_date=start + timedelta(days=days - 1),
        tasks=tasks,
    )
