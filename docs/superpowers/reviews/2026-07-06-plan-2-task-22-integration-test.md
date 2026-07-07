# Task 22 Review: Integration test — full ingestion pipeline

**Date:** 2026-07-06  
**Files modified:** package.json, vitest.config.ts  
**Files created:** test/integration/ingestion.integration.test.ts  

## Summary

Integration test suite created to verify the full ingestion pipeline against live Supabase. The test is gated by `RUN_INTEGRATION=1` environment variable and does not run by default in `npm test`.

## Changes

### 1. package.json
Added new script:
- `"test:int": "RUN_INTEGRATION=1 vitest run test/integration"`

### 2. vitest.config.ts
Updated `include` glob to cover integration tests:
- Added `'test/integration/**/*.test.ts'` to the include array

### 3. test/integration/ingestion.integration.test.ts
Created comprehensive integration test that:
- Verifies full load → split → embed → store pipeline
- Creates test profile with UUID `00000000-0000-0000-0000-000000000001`
- Inserts a document and runs ingestion pipeline
- Validates chunk creation (count > 0)
- Verifies Vietnamese law metadata (Điều labels)
- Confirms embeddings are 768-dimensional pgvector format
- Sets document status to 'ready'
- Cleans up test data (chunks and document) in afterAll
- Timeout: 60 seconds (accounts for live Gemini API calls)

## Behavior

### Default run (npm test)
The integration test is **SKIPPED** when `RUN_INTEGRATION` is not set. All 51 unit tests pass as expected.

### With credentials (npm run test:int)
The test only runs if:
1. `.env.local` is sourced with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_GENERATIVE_AI_API_KEY`
2. Test UUID `00000000-0000-0000-0000-000000000001` exists in `auth.users` (or FK check is disabled)

## How to verify

The integration test **cannot run in this environment** (no credentials), but verify structure:

1. Default suite still passes with integration test skipped:
   ```bash
   npm test -- --run
   # Expected: 51 passing, 1 skipped
   ```

2. Typecheck passes:
   ```bash
   npm run typecheck
   # Expected: 0 errors
   ```

3. User verification (requires .env.local and credentials):
   ```bash
   # In project root:
   set -a && source .env.local && set +a
   npm run test:int
   ```
   **Warning:** First run creates a test profile row `00000000-0000-0000-0000-000000000001`. If this UUID doesn't exist in `auth.users`, the profiles upsert will fail. Either manually create the row in Supabase Studio or drop the FK constraint for the test.

## Test outcomes

- **Integration test skipped in CI/default runs:** Confirmed (RUN_INTEGRATION not set)
- **Unit test suite intact:** All 51 tests passing
- **Typecheck:** 0 errors
- **Integration test file:** Syntactically valid, ready for user execution

## Notes

- Integration test requires live network access (Supabase API + Google Gemini)
- Not part of standard CI pipeline
- Cleanup is automatic via afterAll (chunks → documents)
- Uses service-role client to bypass auth triggers
- Covers spec section 8.3 (integration test requirement)

---

**Status:** Ready for user to run with credentials. Test infrastructure complete, default suite unaffected.
