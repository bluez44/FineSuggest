# Review: Plan 3 Task 5 — ConversationService

**Date:** 2026-07-08
**Reviewer:** Claude (automated)
**Files:**
- `src/lib/services/ConversationService.ts` (created)
- `test/unit/lib/services/ConversationService.test.ts` (created)

## Summary

Implemented `ConversationService` with 8 methods over `conversations` and `messages` Supabase tables, following the same constructor pattern as `DocumentService`.

## Methods Implemented

| Method | Table | Notes |
|---|---|---|
| `list` | conversations | Ordered by `updated_at DESC`, maps to camelCase |
| `create` | conversations | Inserts `{owner_id}`, DB default fills title |
| `rename` | conversations | Scoped by `owner_id`; throws if zero rows updated |
| `delete` | conversations | Scoped by `owner_id` |
| `getMessages` | messages | Ownership check via `ownedBy`, full `StoredMessage` shape |
| `getRecentMessages` | messages | `{role, content}` only; DESC fetch then reversed to oldest→newest |
| `appendMessage` | messages | Citations JSONB only written when non-empty |
| `deleteMessage` | messages | Simple delete by id |
| `ownedBy` | conversations | Returns bool via `maybeSingle()` |

## Test Results

6/6 tests pass. One mock adjustment was needed: the `rename` test's `eqOwner` mock returned a resolved value directly, but the implementation calls `.select('id')` after `.eq('owner_id', ...)`. The mock was extended to add a `.select` link returning the resolved value — implementation was not changed.

## Typecheck

`npx tsc --noEmit` — clean, no errors.

## Full Suite

76 passing, 1 skipped — no regressions.

## Status

PASS — all acceptance criteria met.
