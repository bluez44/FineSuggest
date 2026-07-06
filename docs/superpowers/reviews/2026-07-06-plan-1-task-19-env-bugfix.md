# Task 19 — Configure Google OAuth (bugfix during verification)

- **Plan:** [Plan 1 — Foundation](../plans/2026-06-30-plan-1-foundation.md)
- **Task:** 19 (verification blocker — env module init crash in browser)
- **Date:** 2026-07-06
- **Related task:** 13 (env config)

## What changed

Bug: `src/lib/env.ts` used an IIFE to build `serverEnv` at module top level. Any browser bundle that imported `clientEnv` from the same module also evaluated the `serverEnv` IIFE → threw `serverEnv accessed in browser`. Triggered when `GoogleSignInButton` (client component) → `browser.ts` → `env.ts`.

Fix: replaced the IIFE with a lazy `Proxy` — schema parse only runs on first property access. All existing call sites (`serverEnv.ADMIN_EMAILS`, `serverEnv.SUPABASE_SERVICE_ROLE_KEY`, `serverEnv.NEXT_PUBLIC_SUPABASE_URL`) remain unchanged.

Files:
- `src/lib/env.ts` — swap IIFE for Proxy (lazy eval)

## How to verify

```bash
npm run typecheck   # 0 errors
npm run lint        # 0 errors
npm test -- --run   # 7 tests pass
npm run dev         # visit http://localhost:3000/login — no runtime crash
```

Then manually click **Sign in with Google** → complete Google OAuth consent → should redirect back to `/chat` with session established.

## Deviations from plan

Plan 1 Task 13 didn't specify the eval strategy for `serverEnv`. Original IIFE was correct for pure server usage but broke as soon as a client component transitively imported the module. Proxy pattern is a minor implementation refinement, not a scope change.

## Notes / tech debt

- **Anti-pattern avoided:** splitting into `env.server.ts` / `env.client.ts`. Would have worked but forces every consumer to know which file to import; Proxy keeps a single import path.
- **Future consideration:** if we ever add `import 'server-only'` to the auth guards, the Proxy fallback becomes belt-and-suspenders — the compile-time boundary catches it first.
- Task 19 itself (Google Cloud Console + Supabase Dashboard config) is still awaiting user manual verification of the sign-in flow.
