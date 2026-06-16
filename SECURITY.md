# Security

## ⚠️ Secret rotation required

During early development, the file `backend/.env.example` was committed to the
local workspace with **real** Supabase and DeepSeek credentials, and the file
`app/.env.example` contained a real Supabase URL + anon key.

This has been remediated:

- ✅ Both `.env.example` files now contain only placeholders
- ✅ `backend/.gitignore` and root `.gitignore` are configured to exclude real `.env` files
- ✅ The project was never pushed to a remote repository, so no public exposure

**However**, the previously-saved credentials should be considered compromised
and must be rotated:

### Rotate in Supabase (https://supabase.com → Project Settings → API)

1. **JWT Secret** → click *Generate a new secret* (this invalidates all current user sessions)
2. **Service role key** → click *Roll JWT secret* or regenerate the service_role key
3. **Anon key** → rotate via Dashboard → API → *Generate new anon key* (safe to expose; rotate anyway for hygiene)
4. After rotation, update your local `backend/.env` and `app/.env` with the new values

### Rotate in DeepSeek (https://platform.deepseek.com)

1. **API keys** → *Create new secret key*
2. Delete the old key
3. Update `DEEPSEEK_API_KEY` in `backend/.env`

### Git history check (if you ever pushed)

If a remote repo was ever created with the old `.env.example`, scrub it:

```bash
# Install git-filter-repo (one-time)
pip install git-filter-repo

# Remove .env.example from all history
git filter-repo --path backend/.env.example --invert-paths
git filter-repo --path app/.env.example --invert-paths

# Force-push (only safe if you own the repo and collaborators rebase)
git push origin --force --all
```

Then rotate the keys (above) so the old values become useless.

## Best practices going forward

- **Never** commit a `.env` file (only `.env.example` with placeholders)
- **Never** log secrets, even in dev — `print(api_key)` ends up in CI logs
- The Supabase **anon key** is designed to be public, but treat the project URL
  as semi-private (it reveals the project ID)
- The Supabase **service_role key** and **JWT secret** are server-only — never
  expose them to the browser (Vite env vars are bundled into the JS)
- DeepSeek / OpenAI keys must stay server-side only — the AI planner runs in
  FastAPI, not in the browser
- Add a pre-commit hook to scan for secrets:
  ```bash
  pip install pre-commit detect-secrets
  ```
