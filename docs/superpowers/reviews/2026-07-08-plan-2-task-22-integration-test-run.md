---
Plan: Plan 2 — Ingestion
Task: 22 (integration test execution / smoke run)
Date: 2026-07-08
Status: Passed (1 test, 1 skipped-when-unset)
---

# Task 22 — Execute integration test end-to-end

Run the `RUN_INTEGRATION=1 vitest run test/integration` gate against live Supabase Cloud + Gemini API to confirm the ingestion pipeline works before building Plan 3 on top of it.

## Result

- **1/1 integration test passed** (`ingestion pipeline against live Supabase > runs load → split → embed → store, producing 768-dim chunks`), 6.87s wall time.
- **51/51 unit tests still passing**, 1 skipped-when-`RUN_INTEGRATION`-unset (the integration file gates via `describe.skipIf`).
- **Typecheck clean.**

## What broke on first run (and the fixes)

Three defects surfaced when the test ran for real. All were latent — unit tests + mocks passed because they never touched the outside world.

### 1. `documents` insert returned `null` — profile FK missing

- **Symptom:** `TypeError: Cannot read properties of null (reading 'id')` at `test/integration/ingestion.integration.test.ts:36`.
- **Root cause:** the test hard-coded a synthetic `owner_id = '00000000-0000-0000-0000-000000000001'`, but `profiles.id` FK-references `auth.users.id`, and no auth user with that UUID exists in the cloud DB. Supabase `auth.admin.createUser()` assigns its own UUID and does not accept a caller-supplied `id`, so we can't create the hardcoded id even with service-role.
- **Fix:** replaced the hardcoded UUID with a **lookup-or-create by email** (`ingest-test@example.com`) via `auth.admin.listUsers()` + `auth.admin.createUser()`. The `on_auth_user_created` trigger populates the `profiles` row, so no separate upsert is needed. Both `documents.insert()` and `auth.admin.createUser()` failures now throw explicit errors (they used to fall through as `null!.id`).

### 2. `serverEnv accessed in browser` when embedder ran

- **Symptom:** `Error: serverEnv accessed in browser` thrown from the `Proxy` guard at `src/lib/env.ts:27` inside `GeminiEmbedder.getApiKey`.
- **Root cause:** `vitest.config.ts` sets `environment: 'jsdom'` for the whole project (correct for React component tests), which defines `window`. The lazy `serverEnv` Proxy uses `typeof window !== 'undefined'` as its browser guard, so it fired inside the integration test even though it runs on Node.
- **Fix:** added `// @vitest-environment node` on the integration test file to override the default per-file. Component tests continue to run under jsdom; only this file switches to the Node runtime.
- **Why not weaken the guard?** The guard exists to catch real accidental imports of `env.ts` from client code (the bug we fixed at end of Plan 1). Loosening it would defeat that. Per-file override is the correct scope.

### 3. Gemini model `text-embedding-004` no longer exists

- **Symptom:** `404 models/text-embedding-004 is not found for API version v1beta`.
- **Root cause:** Google retired `text-embedding-004`. Current embedding models (via `ListModels`): `gemini-embedding-001`, `gemini-embedding-2-preview`, `gemini-embedding-2`. The plan and code were pinned to the retired name from training-data / older-docs vintage.
- **Fix in `src/lib/ingestion/embedder/GeminiEmbedder.ts`:**
  - `MODEL = 'text-embedding-004'` → `'gemini-embedding-001'` (stable, GA, supports `batchEmbedContents` and `outputDimensionality`).
  - Added `outputDimensionality: 768` to each request in the batch body. `gemini-embedding-001` defaults to 3072-dim (Matryoshka) — without this parameter, our `EXPECTED_DIM = 768` guard would reject every response.
- **Verified via curl** that `batchEmbedContents` still works on `gemini-embedding-001` (the endpoint is not advertised in `ListModels.supportedGenerationMethods` but is honored). If it ever stops working, fallback is per-item `embedContent` with concurrency control.
- **Column compatibility unchanged:** `chunks.embedding` is `vector(768)` — still matches, no migration needed.

## Unit test / mock impact

Zero changes needed. Unit tests mock `fetch` directly and never assert on the model name or URL, so switching the model was invisible to them.

## Files changed

- `src/lib/ingestion/embedder/GeminiEmbedder.ts` — model rename + `outputDimensionality`.
- `test/integration/ingestion.integration.test.ts` — Node env pragma, lookup-or-create auth user, explicit error throws.

## Verdict

**Pipeline works end-to-end against live services.** All Plan 2 quality gates (spec compliance, unit tests, integration test, typecheck) are green. Ready to move to Plan 3 (RAG chat).

## Notes / tech debt

- **Test user is now persistent** in the cloud DB (`ingest-test@example.com`). Re-runs reuse it. Deleting it manually is safe — the next run recreates it.
- **`gemini-embedding-001` cost:** per Google, embedding is billed per-token, generally 10-100× cheaper than generation. No concerns for dev volume.
- **`asyncBatchEmbedContent` alternative** (advertised in `ListModels`) is job-based and higher throughput for bulk indexing. Not needed for on-upload processing; keep in mind for a future backfill script if we bulk-import a corpus.
