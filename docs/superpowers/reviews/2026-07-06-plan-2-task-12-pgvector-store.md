# Plan 2 Task 12 Review: PgVectorStore (TDD)

**Date:** 2026-07-06  
**Task:** Plan 2 Task 12 — PgVectorStore for chunk storage + document status updates  
**Status:** COMPLETE

## Task

Implement a PostgreSQL+pgvector-backed chunk storage layer using Test-Driven Development:
1. **Create test file** with 4 hand-rolled fake SupabaseClient tests
2. **Implement `PgVectorStore` class** implementing `ChunkStore` interface
3. **Verify:** 4 passing tests, typecheck passes

## What Changed

- **Created:** `test/unit/lib/ingestion/store/PgVectorStore.test.ts`
  - 4 passing tests using hand-rolled fake client (no network)
  - Tests verify delete→insert flow, status updates, error message clearing, and empty chunk handling
  
- **Created:** `src/lib/ingestion/store/PgVectorStore.ts`
  - Implements `ChunkStore` interface (dependency-injected SupabaseClient)
  - `replaceChunks()`: Deletes old chunks, inserts new ones with pgvector serialization
  - `updateDocumentStatus()`: Updates document status + error_message (cleared on 'ready')
  - Throws `IngestionError` on database failures

## How to Verify

1. All tests pass:
   ```bash
   npm test -- --run PgVectorStore
   ```
   Expected: **4 passed**

2. Typecheck passes:
   ```bash
   npm run typecheck
   ```
   Expected: 0 errors (clean exit)

3. Files exist and are importable:
   ```bash
   ls -la src/lib/ingestion/store/PgVectorStore.ts
   ls -la test/unit/lib/ingestion/store/PgVectorStore.test.ts
   ```

## Key Implementation Details

### pgvector Serialization
- Numbers arrays converted to string literals: `[x,y,z]`
- Uses helper function `toPgVector(v: number[]): string`
- Example: `[0.1, 0.2, 0.3]` → `"[0.1,0.2,0.3]"`

### Chunk → Row Mapping
- All optional chunk fields (`dieu`, `khoan`, `diem`, `page`, `metadata`) defaulted to null/empty object
- `metadata` cast as `Record<string, never>` for type compatibility with Supabase's `Json` type

### Document Status Logic
- `updateDocumentStatus()` clears `error_message` (sets to `null`) when status is `'ready'`
- Otherwise preserves the provided error message (or null if not given)
- Triggers database `updated_at` trigger automatically

### Test Strategy (Hand-Rolled Fake)
- Fake client does NOT make network calls (suitable for unit tests)
- Captures call history: `{ table, op, arg, filter }`
- Tests verify exact Supabase API usage patterns without external dependencies

## Deviations

**None.** Implementation follows the brief verbatim:
- TDD approach: test-first → implementation
- 4 tests → 4 passed
- Typecheck: 0 errors
- File paths and code match brief exactly

## Notes / Tech Debt

- **Json type casting:** Supabase's `Database.Json` type is `string | number | boolean | null | { [key: string]: Json } | Json[]`, so `Record<string, unknown>` required explicit cast to `Record<string, never>` for compatibility. This is a type-level constraint, not a runtime concern.

- **Error handling:** Both `replaceChunks` and `updateDocumentStatus` throw `IngestionError` with the `'store'` stage tag, enabling upstream error recovery strategies.

- **Future work:** Task 13 (IngestionService) will orchestrate these store methods across the full pipeline.

---

Generated with Claude Code.
