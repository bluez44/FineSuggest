# Plan 3 — RAG Chat — Final Smoke + Close

- **Plan:** [`docs/superpowers/plans/2026-07-08-plan-3-rag-chat.md`](../plans/2026-07-08-plan-3-rag-chat.md)
- **Spec:** [`docs/superpowers/specs/2026-07-08-plan-3-rag-chat-design.md`](../specs/2026-07-08-plan-3-rag-chat-design.md)
- **Date closed:** 2026-07-09
- **Base commit:** `2df6e68` (plan commit)
- **Head commit:** `b39d278` (UIMessage v7 fix)
- **Commits:** 17 (13 task commits + 1 fix wave + 1 UIMessage shape fix + 2 ledger/misc)

## What shipped

Plan 3 delivers the RAG chat surface end-to-end on top of the Plan 2 ingestion corpus. User asks a Vietnamese traffic-law question, we retrieve top chunks from `chunks` via the `match_chunks` RPC, stream a strictly-grounded answer with `[n]` citation markers via Vercel AI SDK v7, and render clickable citation pills that reveal source snippets.

### Backend

- `src/lib/rag/` — pure function module: `systemPrompt` (strict-RAG Vietnamese constant), `prompt.buildChatMessages` (context + history composition), `citations.parseCitations` (marker extraction with word-boundary snippet truncation), `retrieve.retrieveChunks` (RPC + threshold filter + document-title enrichment).
- `QuotaService.consumeQuestion` — `DAILY_QUESTION_LIMIT=50`, atomic-ish upsert with `remaining` returned.
- `ConversationService` — 8 methods over `conversations` + `messages` tables (list/create/rename/delete/getMessages/getRecentMessages/appendMessage/deleteMessage/ownedBy) plus a best-effort `conversations.updated_at` touch on message append.
- `POST /api/chat` — the RAG orchestrator: auth → ownership/auto-create → quota → persist user → embed (`gemini-embedding-001` 768-dim) → retrieve (`MATCH_COUNT=6`, `MIN_SIMILARITY=0.5`) → short-circuit-or-stream via `streamText(google('gemini-2.5-flash'))` + `createUIMessageStream` + `toUIMessageStream` + `data-citations` + `data-remaining` custom parts + persist assistant + structured observability log with 9 status values.
- Conversation CRUD under `/api/conversations/**` (thin, user-scoped RLS).

### Frontend

- Chat UI: `MessageBubble` (amber-highlighted `[n]` markers + citation pill row), `CitationPill`, `CitationPreviewModal` (snippet + document title), `Composer` (2000-char textarea, Enter submits, IME guard, quota counter), `MessageList` (auto-scroll), `ChatShell` (wires `useChat` from `@ai-sdk/react` v4.0.19 with `DefaultChatTransport`), `ConversationSidebar` (create + delete with per-item in-flight guard).
- Server pages `/chat` (redirects to latest or auto-creates) and `/chat/[id]` (hydrates ChatShell with initial `UIMessage[]` + citations map).

### Tests + quality gates

- **82 unit tests + 2 skipped integration** (integration gated by `RUN_INTEGRATION=1`).
- **1 integration test** (`test/integration/rag.integration.test.ts`) seeds a real document + real `gemini-embedding-001` vectors, invokes the route directly, asserts SSE `data-citations` + persisted messages + quota — passes 1/1 in ~6s against live Supabase Cloud + Gemini.
- **`npx tsc --noEmit`** clean.
- **`npx next build`** succeeds, 14 pages.
- **Manual browser smoke** — all 9 items pass (see below).

## Design decisions locked in

Recorded verbatim from the brainstorm so future audits trace choices back to intent:

| # | Decision |
|---|---|
| A3 | v1 minimal: dropped question rewriting, lazy title generation, Upstash Ratelimit. |
| B1 | Chat model: `gemini-2.5-flash`. |
| C1 | Citations: inline `[n]` markers, pill row below assistant bubble, click → modal with snippet + document title. No PDF viewer. |
| D1 + E1 | History: 3 Q&A pairs; user message persisted before LLM, assistant on `onFinish`. |
| F1 + G1 + H2 | Top-K=6, `MIN_SIMILARITY=0.5`, short-circuit does not refund quota. |
| I1 | Vercel AI SDK v7 UI Messages Stream, `data-citations` custom part. |
| J1 + K1 | Strict-concise system prompt, `[n] (Điều X, Khoản Y, DocTitle) <content>` context format. |
| Arch | Function-based module, no pipeline class. |
| Client split | User-scoped Supabase for CRUD, admin service-role for `/api/chat`. |

## Manual smoke — all items pass

1. ✅ Text streams token-by-token (not delivered as one block at the end).
2. ✅ Answer contains `[1]`/`[2]` markers highlighted amber.
3. ✅ Pill row appears below the assistant bubble with labels like `[1] Điều X, Khoản Y`.
4. ✅ Clicking a pill opens the modal with the correct snippet + document title.
5. ✅ Composer shows **"Còn X câu hôm nay"** counter after streaming.
6. ✅ Reload preserves conversation + messages + citation pills.
7. ✅ Nonsense question triggers the fallback "Tôi không tìm thấy nội dung này trong tài liệu hiện có." with no pill row.
8. ✅ "+ Cuộc trò chuyện mới" creates a new conversation and redirects.
9. ✅ Deleting the active conversation redirects (index route auto-selects the next or creates).

## Bugs caught during execution

Recorded so the Plan 4 process retro can reuse the lessons:

1. **UIMessage v7 shape mismatch (commit `b39d278`).** The plan wrote the `POST /api/chat` Zod schema for the older `{role, content}` payload, but `useChat` in AI SDK v7 posts `UIMessage[]` with `parts: [{type:'text', text}]` and no `content`. Unit tests + integration test both hand-crafted the wrong shape consistent with the route → the mismatch never surfaced until real browser traffic hit the endpoint. Fixed by widening `bodySchema.messages` to accept `parts` with a passthrough part type, plus a `messageText()` helper.
2. **Task 7 schema regression avoided (commit `4c1b69b`).** Reviewer caught the implementer relaxing `z.string().uuid()` → `z.string()` on `conversationId` to accommodate test data (`'c-1'`). Fixed by updating the test data to real UUID literals and restoring `.uuid()`.
3. **Gemini retired `text-embedding-004`.** Already fixed in Plan 2 close-out (Task 22 run) — migrated to `gemini-embedding-001` + `outputDimensionality=768`. Kept working for Plan 3.

## What was cut (YAGNI list — deferred to Plan 4)

- **Question rewriting** (multi-turn follow-ups → standalone query).
- **Lazy conversation title generation** from first message.
- **Upstash Ratelimit middleware** (per-IP + per-user sliding window).
- **Reranker** over top-K chunks.
- **PDF viewer** for citation source.
- **Regenerate / branching** messages.
- **Playwright e2e tests** — waiting for staging deploy.
- **React Testing Library** UI tests — verified visually + integration test covers server side.

## Known tech debt / follow-ups for Plan 4

Track these in the Plan 4 spec so nothing rots.

- **QuotaService race window** (Task 1 review). Read-then-write on `usage_daily`; two concurrent requests may both see `N` and both write `N+1`, undercounting by 1. Documented v1 trade-off — add a Postgres `increment_usage_daily(user_id)` RPC in Plan 4.
- **Empty `Database.Functions` type block** (Task 4 review). `match_chunks` RPC isn't in generated types → `retrieveChunks` uses a local `RpcRow` cast. Regenerate types (`npm run types:db`) once the Supabase CLI is available in the environment.
- **Cross-package generic casts in `ChatShell`** (Task 9 review). `transport as never` (SDK generic variance) and `(part as any).type / .data` (plain `UIMessage` lacks `DATA_PARTS` bound). Revisit when AI SDK v7 stabilizes the discriminated-union inference.
- **`ConversationSidebar` fetches API without runtime validation.** Uses `as { id: string }` on `/api/conversations` POST response. Internal API today; add Zod if the API ever leaves this app.
- **`ConversationService.getMessages` double-checks `ownedBy`** even though `/chat/[id]/page.tsx` already checks. Defensive; keep.
- **Short-circuit path emits `data-remaining` but not `message-metadata`** because the AI SDK 7 `UIMessageChunk` union doesn't allow `writer.write({type:'message-metadata',...})` directly. `ChatShell.onData` handles both shapes so the client is uniform. Revisit when the SDK exposes a metadata writer.
- **Task 21 (Supabase DB Webhook)** still deferred to Plan 4 deploy — needs production URL. Meanwhile local dev uses `scripts/trigger-pending-ingest.mjs` to POST to `/api/ingest/process` after each upload.
- **`next.config` middleware convention deprecation warning** (pre-existing from Plan 1). Not patched here per plan scope.
- **`stale-closure` risk in `ChatShell.onData`** (final-review Minor #5). Reviewer flagged that `messages` read inside `onData` could be stale; in practice `data-citations` fires after `text-end` so this is safe today. Revisit if the SDK reorders emissions.

## Lessons for future plans

- **Never let unit tests, integration tests, and the route all consume the same hand-crafted payload shape** — the UIMessage v7 bug hid because all three sources used the plan's incorrect assumption. Either drive integration tests through a real `fetch()` against a running dev server, or add a Playwright/e2e layer that uses the actual client.
- **Verify SDK versions and API shape at plan-writing time.** The plan referenced "Vercel AI SDK v5" while the installed package was v7 — the standalone helpers and the `UIMessage.parts` payload came from v7. A five-minute check against `node_modules/ai/dist/index.d.ts` at plan time would have caught both.
- **Model name pinning is a rot vector.** Plan 2 pinned `text-embedding-004` and the model was retired before we shipped. Consider re-checking model names against `models?key=...` at spec time.

## Next step — Plan 4 (Deploy + hardening)

- Deploy to Vercel (production URL).
- Register Supabase DB Webhook against production URL (Task 21 resumed).
- Provision Upstash Redis + wire `@upstash/ratelimit` in `middleware.ts` for `/api/chat` + `/api/documents/upload`.
- Close the quota race with a Postgres RPC (`increment_usage_daily`).
- Regenerate `Database.Functions` types.
- Add Playwright e2e (login + upload + chat + citation click).
- Add `ADMIN_EMAILS` bootstrap flow validation on prod domain.

Plan 3 is closed.
