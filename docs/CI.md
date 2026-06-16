# CI

GitHub Actions runs on every push to `master` and on every pull request. The
workflow lives at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Jobs

| # | Job | What it checks | Always runs? |
|---|---|---|---|
| 1 | `backend` | Full pytest suite (unit + integration), Python 3.12, pip cache | ✅ |
| 2 | `frontend` | `tsc --noEmit`, ESLint, Vitest, `vite build`, Node 20, npm cache | ✅ |
| 3 | `ai-personalization` | Backend test that mocks the LLM and proves the user's **goal + timeframe + pillars + resources** all reach the AI prompt | ✅ |
| 4 | `ai-personalization-frontend` | Vitest run of `PromptPage.test.tsx` — same contract on the client side: the right shape reaches `api.plans.generate()` | ✅ |
| 5 | `ai-real-llm` | Hits the real DeepSeek-via-NVIDIA-NIM endpoint with a live API key | ❌ only if `NVIDIA_API_KEY` secret is set |

Jobs 1 → 2 are independent. Job 3 waits on 1; job 4 waits on 2. Job 5 waits on
3 and is skipped entirely when the secret is empty.

## Why a dedicated AI personalization job

The product's headline feature is: *"Cast your goal, timeframe, pillars,
and resources into a personalized quest."* That sentence has a specific
contract — every input the user provides must reach the LLM. If anyone
ever refactors `app/services/ai_planner.py` and drops the goal from the
prompt, or skips enrichment for attachments, the existing happy-path
tests would still pass (because they mock the LLM with a canned response).
This test file catches that class of bug.

The test file is `backend/tests/test_ai_personalization.py`. It uses a
mocked OpenAI client and asserts that the captured call contains:

- The goal text verbatim (`TestGoalTextPersonalization`)
- The correct day count for the chosen timeframe (`TestTimeframePersonalization`)
- All selected pillars, with no extras (`TestPillarPersonalization`)
- The enriched link metadata AND the decoded text from file attachments (`TestResourcePersonalization`)
- The user's `custom_prompt`, if any (`TestCustomPromptPersonalization`)
- The `response_format=json_schema` request and model name from settings (`TestRequestShape`)
- The parsed `GeneratedPlan` returned to the caller (`TestResponsePipeline`)

If any of these contracts breaks, CI fails before the change can be merged.

## Why a separate "real LLM" job

Mocked tests can only prove that the planner passes the right inputs to
the LLM. They can't prove that the LLM actually generates a valid plan
or that the user's NVIDIA key still works. Job 5 closes that gap by
calling the real endpoint, but it costs ~$0.01 per run and depends on
network + rate limits, so it stays opt-in.

### Enabling the real-LLM job

1. Get a key at [https://build.nvidia.com](https://build.nvidia.com) →
   any DeepSeek model → **Get API Key**.
2. In the GitHub repo, go to **Settings → Secrets and variables → Actions**
   → **New repository secret**.
3. Name: `NVIDIA_API_KEY` · Value: `nvapi-...` (your key).
4. The next push to `master` will include the `ai-real-llm` job. PRs from
   forks do not have access to secrets, so the job is silently skipped
   for them.

You can also enable the job for a single branch run via
`workflow_dispatch` if you need to test before merging.

## Local reproduction

```bash
# Backend — full suite
cd backend
.venv/bin/pytest

# Just the personalization contract
.venv/bin/pytest tests/test_ai_personalization.py -v

# With your real key (writes a temp .env)
printf "NVIDIA_API_KEY=nvapi-...\n" > .env
.venv/bin/pytest tests/test_llm_integration.py -v

# Frontend
cd ../app
npm test
npx vitest run src/pages/__tests__/PromptPage.test.tsx
```

## Test counts

| Suite | Tests | Runtime |
|---|---|---|
| Backend (`pytest`) | ~225 (only 2 fail without a real key — `test_llm_integration.py`) | ~30s |
| Frontend (`vitest`) | 195 | ~250s (DOM-heavy) |
| Personalization (backend, always) | 17 | <1s |
| Personalization (frontend, always) | 1 in `PromptPage.test.tsx` | <1s |
| Real LLM (optional) | 5 | ~10s |

## Adding new tests

- **Backend:** drop a new `tests/test_*.py` — pytest discovers it
  automatically. Follow the `Test*` class + `test_*` method naming.
- **Frontend:** drop a new `*.test.tsx` next to the file you test, or
  under `__tests__/`. Vitest discovers it.
- **Personalization contract:** any change to the user-facing
  PromptPage or the backend planner should be paired with a test in the
  matching personalization file. Treat those as locked-in.
