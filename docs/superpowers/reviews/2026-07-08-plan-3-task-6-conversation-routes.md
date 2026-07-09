# Task 6 Review: Conversation CRUD API Routes

## Summary

Successfully implemented 3 conversation CRUD API route files under `src/app/api/conversations/**` that wrap the `ConversationService` (Task 5). All endpoints follow the established pattern from Plan 2's `/api/documents` routes.

## Routes Created

1. **`src/app/api/conversations/route.ts`**
   - `GET /api/conversations` — List user conversations (returns `conversations` array)
   - `POST /api/conversations` — Create new conversation (returns `{id, title, ...}` with 201)

2. **`src/app/api/conversations/[id]/route.ts`**
   - `PATCH /api/conversations/[id]` — Rename conversation (validates title, returns 204 on success)
   - `DELETE /api/conversations/[id]` — Delete conversation (checks ownership, returns 204 on success)

3. **`src/app/api/conversations/[id]/messages/route.ts`**
   - `GET /api/conversations/[id]/messages` — List messages for a conversation (returns `messages` array)

## Implementation Details

- All routes use `export const runtime = 'nodejs'`
- Authentication via `createServerClient()` (user-scoped RLS) with `supabase.auth.getUser()`
- Unauthorized requests return `401 JSON { error: 'unauthorized' }`
- PATCH validates title via Zod schema: `z.string().min(1).max(200)`
- DELETE checks ownership via `svc.ownedBy(id, user.id)` before deletion
- GET messages maps `/not found|not owned/i` errors to 404, else 500
- Next.js 16 dynamic params properly typed and awaited: `params: Promise<{ id: string }>`
- No unit tests added (thin orchestration layer, verified via integration in Task 12 + manual smoke in Task 13)

## Testing

- `npx tsc --noEmit` — Clean (no new type errors)
- `npx vitest run` — 76 passed, 1 skipped (unchanged from baseline)

## Verification Notes

Manual curl smoke testing (Step 4 of brief) is **deferred to Task 13** (final integration smoke). This requires:
- A live dev server running (`npm run dev`)
- OAuth session established in browser
- Session cookie extracted and passed to curl requests

The routes themselves are thin orchestration that directly wrap `ConversationService` (which is tested), so functional verification will occur during the full integration pipeline test in Task 12 and manual verification in Task 13.

## Files Modified

- Created: `src/app/api/conversations/route.ts`
- Created: `src/app/api/conversations/[id]/route.ts`
- Created: `src/app/api/conversations/[id]/messages/route.ts`
