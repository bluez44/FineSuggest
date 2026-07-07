# Review: POST /api/ingest/process Worker Route (Task 16)

## 1. Implementation Summary

Created `src/app/api/ingest/process/route.ts` — a webhook-guarded worker endpoint that:
- Validates `Authorization: Bearer <secret>` against `INGEST_WEBHOOK_SECRET`
- Parses the Supabase DB Webhook payload (`{ type, table, record }`) via Zod schema
- Skips non-pending documents (returns 200 with `{ skipped: true }`)
- Builds a service-role Supabase client (bypasses RLS) and an `IngestionPipeline`
- For `url` sources: passes `{ kind: 'url', url }` directly to the pipeline
- For file sources: downloads from Storage bucket `documents`, wraps in a `BufferInput`
- Returns `{ ok: true, chunkCount }` on success or `{ error }` with 400/500 on failure
- On early-exit errors, marks `status='failed'` and sets `error_message` in the DB

## 2. Auth & Security Model

- Shared-secret Bearer token scheme — secret must be ≥16 chars (min), recommended 64 hex chars
- `INGEST_WEBHOOK_SECRET` validated at server startup via Zod in `serverEnv`
- Route uses `SUPABASE_SERVICE_ROLE_KEY` to create an admin client; RLS bypassed intentionally for the ingestion worker
- No user session required — this is a machine-to-machine call from Supabase Webhooks

## 3. Payload Schema & Edge Cases

- Zod `bodySchema` makes `type` and `table` optional (Supabase may omit them in some webhook versions)
- `record.status !== 'pending'` guard prevents double-processing on webhook retries
- `source_url` nullability checked before use; `storage_path` nullability checked before download
- `guessMime` covers all 4 file-based source types with exhaustive switch (TypeScript validates coverage)
- `failStatus` helper always marks DB row and returns HTTP 400 for early exits

## 4. Runtime Configuration

- `export const runtime = 'nodejs'` — required for pdfjs-dist / mammoth / jsdom in pipeline
- `export const maxDuration = 300` — 5-minute cap for Pro plan; Hobby plan is capped at 60s by Vercel
- No client-side imports; `serverEnv` proxy guards against accidental browser access

## 5. Build & Test Verification

✓ Typecheck: 0 errors (`tsc --noEmit`)
✓ Build: Route compiled as `ƒ /api/ingest/process` (Dynamic, server-rendered on demand)
✓ Test suite: 14 test files, 51 tests — all pass, no regressions
✓ `INGEST_WEBHOOK_SECRET` value added to `.env.local` — length: 64 characters (32 random bytes as hex)

Notes: Secret generated via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — produces a 64-character hex string. `.env.local` not staged or committed.

## Post-review fixes (2026-07-06)

**Fix 1 (bearer timing-safe comparison):** The original `auth !== expected` string comparison was vulnerable to timing-based secret oracle attacks. Replaced with SHA-256 hash of both values followed by `timingSafeEqual` from `node:crypto`, eliminating the early-exit branch that could leak secret length information.

**Fix 3B (source_url SSRF scheme restriction):** `z.string().url()` accepted `file://`, `javascript:`, and `data:` URIs; Node `fetch` can follow `file://` to read local files. Added a `.refine()` guard on `source_url` inside `bodySchema` that rejects any non-null value not starting with `http://` or `https://`.

**Fix 5 (failStatus error logging):** `failStatus()` previously discarded the Supabase `update` return value, so DB write failures were silently swallowed. Destructured `{ error }` from the update response and added a `console.error` log when it is non-null, ensuring infrastructure errors surface in server logs.
