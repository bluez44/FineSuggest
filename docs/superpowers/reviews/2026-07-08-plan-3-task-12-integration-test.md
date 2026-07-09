# Plan 3 Task 12 – RAG Integration Test Review

**Date:** 2026-07-08  
**Task:** End-to-end RAG chat pipeline test against live Supabase + Gemini  
**Files:** `test/integration/rag.integration.test.ts`, `test/fixtures/rag/seeded-law.txt`

## Result

1/1 integration test passed. Wall time ~6s (network round-trips to Supabase + two Gemini API calls: one for embedding the query, one for the LLM completion). Unit suite unchanged at 82/1.

## Mock approach: vi.doMock (not monkey-patch)

The task brief listed monkey-patching as the primary approach, with `vi.doMock` as fallback. In this codebase (Vite + strict ESM), the `@/lib/supabase/server` module export is read-only — attempting to assign `createServerClient` on the module namespace threw:

```
TypeError: Cannot set property createServerClient of [object Module] which has only a getter
```

Switched immediately to `vi.doMock('@/lib/supabase/server', () => ({ createServerClient: async () => ({...}) }))` called before `vi.resetModules()` + dynamic `import('@/app/api/chat/route')`. No `try/finally` restore block needed; `vi.doMock` scope is per-test.

## Fixture

`test/fixtures/rag/seeded-law.txt` — two Vietnamese traffic-law paragraphs (Điều 5 and Điều 6). The `beforeAll` filters for lines starting with `Khoản`, yielding exactly 2 chunks, which are embedded with real 768-dim Gemini vectors and inserted into `chunks`.

## Assertions

All four assertions pass as specified:
- Response status 200.
- SSE payload contains `data-citations`.
- `messages` table has 2 rows (user + assistant), assistant `citations` length ≥ 1.
- `usage_daily.question_count` = 1 for the test user + today.

## TypeScript

Four `Object is possibly 'undefined'` errors from indexed array access were fixed with `!` non-null assertions (standard pattern for post-`expect().toHaveLength()` code).

## Cleanup

`afterAll` deletes messages → conversation → chunks → document → `usage_daily` row, guarded by null-checks to handle partial `beforeAll` failures gracefully.
