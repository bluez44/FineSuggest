# Plan 3 Task 1 Review: Extend QuotaService with consumeQuestion

**Date:** 2026-07-08  
**Task:** Plan 3 Task 1 — RAG Chat Quota: Daily Question Limit  
**Status:** COMPLETE

## What

Extended `QuotaService` with a new method `consumeQuestion(userId: string)` to enforce a daily question limit (50 questions per user per calendar day). Returns `{ ok: true; remaining: number }` on success, or `{ ok: false; reason: string }` (in Vietnamese) on failure.

Added two new exports:
- `DAILY_QUESTION_LIMIT = 50` constant
- `ConsumeResult` type for the method's return value

## Why

Plan 3 (RAG Chat) requires quota enforcement to rate-limit users. Each question asked against the RAG index consumes one question from their daily allowance. This prevents abuse and manages compute/embedding costs. The quota state is stored in the `usage_daily` table (migrated in Plan 1), keyed by `(user_id, day)` where `day` is today's ISO date.

## Files Changed

- **Modified:** `src/lib/services/QuotaService.ts`
  - Added `DAILY_QUESTION_LIMIT = 50` export
  - Added `ConsumeResult` type export
  - Implemented `QuotaService.consumeQuestion(userId: string): Promise<ConsumeResult>`

- **Created:** `test/unit/lib/services/QuotaService.consumeQuestion.test.ts`
  - 4 test cases covering: first question of day, at-limit boundary, over-limit rejection, DB error handling
  - All tests use mocked Supabase client to simulate read/upsert flows

## How to Verify

1. **Specific test passes:**
   ```bash
   npm test -- test/unit/lib/services/QuotaService.consumeQuestion.test.ts
   ```
   Expected: `4 passed`

2. **Full test suite passes:**
   ```bash
   npm test
   ```
   Expected: `55 passed, 1 skipped` (new 4 tests included)

3. **Typecheck clean:**
   ```bash
   npx tsc --noEmit
   ```
   Expected: no errors

## Implementation Notes

### Read-Then-Write Race Window (v1 Limitation)

The method currently uses a two-step approach:
1. **Read:** Fetch today's `question_count` for the user via `maybeSingle()`
2. **Write:** Upsert with `nextCount = (existing?.question_count ?? 0) + 1`

This design accepts a small race window: if two concurrent requests both read the same value N before either writes, both will write N+1, undercounting by 1. This is documented trade-off for v1 to avoid requiring a Postgres function (which would require a migration).

**Resolution for Plan 4 hardening:**
- Migrate a Postgres function `increment_usage_daily(user_id, day)` that atomically increments and returns the new count
- Call it via `client.rpc('increment_usage_daily', { user_id, day })`
- Eliminates the race window entirely

### Error Messages (Vietnamese)

Per project convention, all error `reason` strings are in Vietnamese:
- `'Không đọc được quota'` — Read error
- `'Không cập nhật được quota'` — Write error
- `'Quota hết: Bạn đã dùng hết 50 câu hỏi hôm nay'` — Limit exceeded (includes "Quota" for test regex matching)

### Test Mock Strategy

The test mock client dynamically routes:
- `.from('usage_daily').select()...maybeSingle()` → returns `{ data: null, error: null }` (simulating "no record yet")
- `.from('usage_daily').upsert()...select().single()` → returns the mocked upsert result

This allows testing both the happy path (consuming questions within limit) and error paths (over limit, DB errors).

## Deviations

None. Implementation follows the brief exactly.

## Tech Debt & Future Work

1. **Atomic increment RPC (Plan 4):** Add Postgres function to close the read-then-write race. Priority: medium (affects correctness under high concurrency).

2. **Monitoring:** Add logging for quota enforcement decisions (rejections, near-limit warnings). Currently silent on error.

3. **Reset testing:** Verify daily reset works correctly at date boundary (midnight UTC). Current test suite doesn't validate this edge case.

---

Generated with Claude Code.
