# Task 19 — Configure Google OAuth (completed)

- **Plan:** [Plan 1 — Foundation](../plans/2026-06-30-plan-1-foundation.md)
- **Task:** 19 (manual configuration + verification)
- **Date:** 2026-07-06

## What changed

Nothing in the repo. Task 19 is external configuration.

- Google Cloud Console: OAuth consent screen + Web application client with redirect URI `https://xybjldnhlpnkmlkijcfk.supabase.co/auth/v1/callback`
- Supabase Dashboard → Authentication → Providers → Google: Client ID + Secret pasted, provider enabled
- Supabase Dashboard → Authentication → URL Configuration: Site URL `http://localhost:3000`, Redirect URLs allow `http://localhost:3000/api/auth/callback` and `http://localhost:3000/**`

## How to verify

1. `npm run dev`
2. Visit http://localhost:3000/login
3. Click **Sign in with Google** → complete consent screen
4. Redirect back to `/chat`, header shows email/avatar

User confirmed working ("Ổn rồi").

## Deviations from plan

Blocked briefly by unrelated env module init bug — see [2026-07-06-plan-1-task-19-env-bugfix.md](./2026-07-06-plan-1-task-19-env-bugfix.md).

## Notes / tech debt

- Google OAuth consent screen is in **Testing** mode with `vlqvinh444@gmail.com` as the sole test user. Before public deploy, either move to Production or add production allowed users.
- Site URL + Redirect URLs are still localhost. Before Vercel deploy, add production origin to both fields in Supabase Dashboard.
