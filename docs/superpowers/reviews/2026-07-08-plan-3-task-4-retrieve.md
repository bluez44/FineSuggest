# Review: Plan 3 Task 4 — `retrieveChunks` + `match_chunks` RPC

**Date:** 2026-07-08
**Author:** Claude Code (automated)

## Summary

Task 4 creates `src/lib/rag/retrieve.ts`, which calls the `match_chunks` Supabase RPC, filters results by `MIN_SIMILARITY = 0.5`, and enriches each chunk with `documentTitle` via a second `documents.select().in()` query. `ChunkForPrompt` in `prompt.ts` is now a `Pick<RetrievedChunk, ...>` alias rather than a separately declared interface.

## What was done

- Created `src/lib/rag/retrieve.ts` with `RetrievedChunk`, `MIN_SIMILARITY`, `MATCH_COUNT`, and `retrieveChunks`.
- Modified `src/lib/rag/prompt.ts`: replaced the local `ChunkForPrompt` interface with `import type { RetrievedChunk } from './retrieve'` and a `Pick<>` type alias — name preserved, callers unaffected.
- Created `test/unit/lib/rag/retrieve.test.ts` with 4 tests (filter, empty, error, title enrichment).
- All 70 tests pass; `tsc --noEmit` is clean.

## Test results

| Suite | Tests |
|---|---|
| retrieve.test.ts | 4 passed |
| prompt.test.ts | 5 passed |
| citations.test.ts | 6 passed |
| All other suites | 55 passed, 1 skipped |

## Notes / Tech debt

- **Empty `Functions` block in generated `Database` types.** The Supabase CLI did not pick up the `match_chunks` RPC when types were last generated. As a workaround, `retrieve.ts` declares a local `RpcRow` interface and casts `client.rpc` to an explicit function signature. This is correct at runtime (the RPC exists in production) but loses static type safety for the RPC call. **Regenerating types with `supabase gen types typescript` should be done in a future task once the Supabase CLI is available in the CI environment.**
- Fallback title `'(Không rõ tài liệu)'` is applied for any `document_id` not returned by the second query (e.g., deleted documents).
- `docErr.message` property access in the enrichment error path assumes the Supabase error object has a `message` string — consistent with how RPC errors are handled above.
