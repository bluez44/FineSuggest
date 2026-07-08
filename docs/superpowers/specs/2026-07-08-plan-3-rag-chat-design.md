# FineSuggest — Plan 3 (RAG Chat) Design

- **Date:** 2026-07-08
- **Author:** brainstormed with Claude Opus 4.7
- **Predecessor:** Plans 1 (Foundation) + 2 (Ingestion) complete; corpus of `chunks` with 768-dim `gemini-embedding-001` vectors already lives in Supabase.
- **Successor:** Plan 4 (deploy + rate limit + Supabase webhook registration).

## 1. Goal & scope

Ship the RAG chat surface on top of the Plan 2 ingestion corpus: user asks a question in Vietnamese about traffic law, we retrieve the most relevant chunks, stream a strictly grounded answer with inline `[n]` citation markers, and render clickable citation pills that reveal the source chunk.

### 1.1 In scope (v1)

- `POST /api/chat` streaming route handler using Vercel AI SDK v5 (`streamText` + `toUIMessageStreamResponse`) with `gemini-2.5-flash`.
- Vector retrieval via existing `match_chunks` RPC + JS-side similarity threshold + title enrichment.
- Strict-RAG system prompt with `[n]`-marker citation contract.
- Conversation CRUD (`GET/POST /api/conversations`, `PATCH/DELETE /api/conversations/:id`, `GET /api/conversations/:id/messages`).
- Daily quota via existing `QuotaService.consumeQuestion` (50 questions/day/user), enforced before embed.
- Chat UI at `/chat` and `/chat/[id]` — sidebar (conversations list + New), main pane (message list + composer), citation pill row per assistant message, citation snippet modal.
- Bounded history: 3 most recent Q&A pairs sent with each new question.
- Short-circuit "not found" response (no LLM call) when no chunk clears the similarity threshold.
- Full unit test suite + one integration test running end-to-end against live Supabase + Gemini.

### 1.2 Out of scope (deferred)

- **Question rewriting** (rewrite follow-ups to standalone queries). Defer — add only if multi-turn quality proves bad in practice.
- **Lazy conversation title generation** (LLM-generated title from first message). Defer — UI shows `Cuộc trò chuyện mới` until user renames.
- **Upstash Ratelimit** middleware. Defer to Plan 4 (edge deployment).
- **Reranker** (cross-encoder over top-K). Defer to future when retrieval quality is measured.
- **Regenerate / branching messages**. Defer.
- **Streaming citation preview** (rendering pill placeholders as they resolve). Defer.
- **PDF viewer for citation source**. Defer — snippet in the modal is enough for v1.
- **E2E Playwright tests**. Defer to Plan 4 once staging deploy exists.

## 2. Design decisions

Recorded verbatim from brainstorming so the plan writer and reviewer can trace choices back to intent.

| # | Decision |
|---|---|
| A3 | v1 minimal: **drop** question rewriting, lazy title, Upstash Ratelimit. |
| B1 | Chat model: `gemini-2.5-flash` via `@ai-sdk/google`. |
| C1 | Citations: inline `[n]` markers in text, pill row rendered below assistant bubble, click opens modal with snippet (≤300 chars) + document title. No PDF viewer. |
| D1 | History window: 3 most recent Q&A pairs (~6 messages). |
| E1 | Persist ordering: user message written to DB **before** LLM call; assistant message written in `onFinish` after stream completes. |
| F1 | `match_count` = 6. |
| G1 | `MIN_SIMILARITY` = 0.5 (client-side filter after RPC). |
| H2 | Short-circuit response when retrieval empty — **does NOT refund quota** (quota measures requests, not answers). |
| I1 | Streaming: Vercel AI SDK v5 UI Messages Stream (`streamText` → `toUIMessageStreamResponse()`), client uses `useChat`. Citations delivered via `data-citations` message part. |
| J1 + K1 | Strict + concise system prompt; context chunks formatted as `[n] (Điều X, Khoản Y, Điểm Z, <Doc Title>) <content>`; natural `CONTEXT:` delimiter (no XML tags). |
| Arch | Function-based module in `src/lib/rag/` (no pipeline class); orchestration lives in the route handler. |
| Client split | User-scoped Supabase client (RLS-enforced) for conversation CRUD routes; admin (service-role) client for `/api/chat` (needs to write `usage_daily` and bypass RLS uniformly). |

## 3. File layout

```
src/lib/rag/
├── retrieve.ts           # retrieveChunks(embedding, userId, client) → RetrievedChunk[]
├── prompt.ts             # buildChatMessages(retrieved, history, question) → { system, messages }
├── citations.ts          # parseCitations(text, retrieved) → Citation[]
└── systemPrompt.ts       # const strictRagSystemPrompt

src/lib/services/
├── ConversationService.ts   # CRUD + getRecentMessages + appendMessage + deleteMessage + ownedBy
└── QuotaService.ts          # (from Plan 2) — consumeQuestion() added if not already present

src/app/api/
├── chat/route.ts                       # POST — RAG streaming
└── conversations/
    ├── route.ts                        # GET list + POST create
    ├── [id]/
    │   ├── route.ts                    # PATCH rename + DELETE
    │   └── messages/route.ts           # GET messages (full, with citations)

src/components/chat/
├── ChatShell.tsx              # /chat client shell: sidebar + main pane
├── ConversationSidebar.tsx    # conversations list, "New" button, active highlight
├── MessageList.tsx            # useChat messages + scroll to bottom on stream
├── MessageBubble.tsx          # renders 1 message + (assistant only) citation pill row
├── CitationPill.tsx           # clickable label; opens modal
├── CitationPreviewModal.tsx   # snippet + document title
└── Composer.tsx               # textarea + send button + "X câu/ngày còn lại"

src/app/(app)/chat/
├── page.tsx                   # server: fetch conversations → redirect /chat/{latest} or create+redirect
└── [id]/page.tsx              # server: fetch messages → hydrate ChatShell with initial state
```

## 4. Unit contracts (interfaces)

### 4.1 `src/lib/rag/retrieve.ts`

```typescript
export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  page: number | null;
  similarity: number;
  documentTitle: string; // enriched after RPC
}

export const MIN_SIMILARITY = 0.5;
export const MATCH_COUNT = 6;

export async function retrieveChunks(
  queryEmbedding: number[],
  userId: string,
  client: SupabaseClient<Database>,
): Promise<RetrievedChunk[]>;
```

Behavior:
- Calls RPC `match_chunks(query_embedding, match_count=6, caller_user_id=userId)`.
- Filters `similarity >= 0.5` in JS.
- Second query `documents.select('id,title').in('id', docIds)` for title enrichment.
- Empty result → `[]` (no throw).
- RPC error → throw (surfaces to route handler as 500).

### 4.2 `src/lib/rag/systemPrompt.ts`

```typescript
export const strictRagSystemPrompt = `Bạn là trợ lý pháp luật giao thông Việt Nam. CHỈ trả lời dựa trên các đoạn trích trong phần CONTEXT bên dưới. Tuyệt đối không suy đoán, không bổ sung kiến thức ngoài context.

Nếu CONTEXT không đủ thông tin để trả lời, hãy nói:
"Tôi không tìm thấy nội dung này trong tài liệu hiện có."

Khi trích dẫn, dùng marker [n] tương ứng với số thứ tự đoạn trong CONTEXT. Trả lời ngắn gọn, rõ ràng, đúng pháp lý.`;
```

### 4.3 `src/lib/rag/prompt.ts`

```typescript
import type { ModelMessage } from 'ai';
import type { RetrievedChunk } from './retrieve';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function buildChatMessages(
  retrieved: RetrievedChunk[],
  history: HistoryMessage[],
  question: string,
): { system: string; messages: ModelMessage[] };
```

Behavior:
- `system` = `strictRagSystemPrompt + '\n\nCONTEXT:\n' + chunks.map(formatChunk).join('\n\n')`.
- `formatChunk(n, c)` = `[${n}] (${labelParts(c)}) ${c.content}` where `labelParts` joins non-null parts of `dieu`, `khoan`, `diem` plus `documentTitle` with `, `.
- `messages` = `[...history.map(toModelMessage), { role: 'user', content: question }]`.
- Pure function — no I/O, no side effects.

### 4.4 `src/lib/rag/citations.ts`

```typescript
export interface Citation {
  chunkId: string;
  documentId: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  page: number | null;
  documentTitle: string;
  snippet: string; // ≤ 300 chars, cut at word boundary if possible
  markerIndex: number; // n from [n]
}

export function parseCitations(
  assistantText: string,
  retrieved: RetrievedChunk[],
): Citation[];
```

Behavior:
- Regex `/\[(\d+)\]/g` finds all markers.
- Dedupe by number; preserve first-appearance order.
- Marker `n` maps to `retrieved[n - 1]` (1-indexed).
- Out-of-range `n` → skip silently (LLM hallucinated marker; do not throw).
- `snippet`: `content.slice(0, 300)`; if last char is mid-word, trim back to nearest space.

### 4.5 `src/lib/services/ConversationService.ts`

```typescript
export class ConversationService {
  constructor(private client: SupabaseClient<Database>) {}

  async list(userId: string): Promise<Array<{ id: string; title: string; updatedAt: string }>>;
  async create(userId: string): Promise<{ id: string; title: string }>;
  async rename(id: string, userId: string, title: string): Promise<void>;
  async delete(id: string, userId: string): Promise<void>;
  async getMessages(id: string, userId: string): Promise<Array<StoredMessage>>;
  async getRecentMessages(id: string, limit: number): Promise<HistoryMessage[]>;
  async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    citations?: Citation[],
  ): Promise<{ id: string }>;
  async deleteMessage(id: string): Promise<void>;
  async ownedBy(id: string, userId: string): Promise<boolean>;
}
```

Notes:
- `getRecentMessages` returns oldest-to-newest, capped to `limit`, sends only `role` + `content` (no citations, no id).
- `rename` / `delete` / `getMessages` implicit-check ownership by including `.eq('owner_id', userId)` in the query (works for either user-scope or admin client).
- `appendMessage` writes `citations` as JSONB.

## 5. Route handlers

### 5.1 `POST /api/chat`

**Input** (Vercel AI SDK `useChat` payload):
```json
{ "messages": [...], "data": { "conversationId": "uuid | null" } }
```

**Flow:**

1. `requireUser()` → `userId` or `401`.
2. `data.conversationId` — if provided: `ConversationService(admin).ownedBy(...)` → `403` on mismatch. If absent: `create(userId)` → new id, will be included in the stream metadata for client redirect.
3. `QuotaService.consumeQuestion(userId)` — atomic upsert on `usage_daily`. Returns `question_count`; if `> DAILY_QUESTION_LIMIT` → `429 { error:'quota_exceeded', dailyLimit: 50 }`.
4. `appendMessage(conversationId, 'user', question)` → capture `userMessageId` for rollback.
5. `GeminiEmbedder({}).embedBatch([question])` → 768-dim vector. On failure after retry → `deleteMessage(userMessageId)` and return `500`.
6. `retrieveChunks(embedding, userId, admin)` → `RetrievedChunk[]`. RPC error → rollback user message + `500`.
7. **Short-circuit** if `retrieved.length === 0`:
   - Build a `createUIMessageStream` that writes one `text-delta` with the fallback string and immediately finishes.
   - In the same handler, `appendMessage(conversationId, 'assistant', FALLBACK, [])`.
   - Return `toUIMessageStreamResponse(stream)`. Do **not** call the LLM.
8. `history = ConversationService(admin).getRecentMessages(conversationId, 6)` — excludes the user message just inserted (either via `.lt('created_at', userMessage.createdAt)` or `.neq('id', userMessageId)`).
9. `buildChatMessages(retrieved, history, question)` → `{ system, messages }`.
10. `streamText({ model: google('gemini-2.5-flash'), system, messages, onFinish })`.
   - `onFinish({ text })`:
     - `parseCitations(text, retrieved)` → `Citation[]`.
     - `appendMessage(conversationId, 'assistant', text, citations)`.
     - Emit `data-citations` UI message part with the `Citation[]`.
11. Return `result.toUIMessageStreamResponse({ messageMetadata })` — includes `conversationId` in metadata so a new-conversation client can redirect to `/chat/{id}`.

**Streaming shape (v5 UI Messages):**
- Text deltas stream tokens as they arrive.
- `data-citations` custom part is written once in `onFinish` before stream close.
- Client's `useChat` reads text into the message bubble and lifts `data-citations` into `message.parts` for pill row rendering.

### 5.2 Conversation CRUD routes

- All use **user-scoped Supabase client** via `createServerClient` from `@supabase/ssr` (existing helper).
- `GET /api/conversations` → `service.list(userId)`.
- `POST /api/conversations` → `service.create(userId)` → 201 with `{id, title}`.
- `PATCH /api/conversations/:id` → parse `{title: string}`, `service.rename(id, userId, title)` → 204.
- `DELETE /api/conversations/:id` → `service.delete(id, userId)` → 204. Cascades to `messages` via FK.
- `GET /api/conversations/:id/messages` → `service.getMessages(id, userId)` → 200 with `Message[]` including citations.

## 6. Data flow (POST /api/chat)

```
Client (useChat)
    │  POST /api/chat  { messages, data: { conversationId } }
    ▼
route.ts
    ├─ 1. requireUser → userId | 401
    ├─ 2. Ownership check / auto-create conversation
    ├─ 3. QuotaService.consumeQuestion  ← atomic; 429 if exceeded
    ├─ 4. appendMessage(userId, 'user', question) → userMessageId
    ├─ 5. GeminiEmbedder.embedBatch([question]) → vector[768]
    ├─ 6. retrieveChunks(vector, userId, admin) → RetrievedChunk[]
    ├─ 7. IF empty → short-circuit stream + persist fallback assistant + return
    ├─ 8. history = getRecentMessages(conversationId, 6, exclude=userMessageId)
    ├─ 9. buildChatMessages(retrieved, history, question) → { system, messages }
    ├─ 10. streamText(...) with onFinish:
    │        - parseCitations(text, retrieved)
    │        - appendMessage('assistant', text, citations)
    │        - writer.write({ type:'data-citations', data: citations })
    └─ 11. return toUIMessageStreamResponse(...)  ← streams tokens
```

Client `useChat`:
- Appends streamed tokens into the assistant bubble as they arrive.
- On `data-citations` part received → renders pill row via `MessageBubble`.
- On stream close → `messages` state final, composer re-enables.

## 7. Error handling matrix

| Step | Failure | Response | State cleanup |
|---|---|---|---|
| 1 | No session | 401 JSON | none |
| 2 | Conversation not owned | 403 JSON | none |
| 3 | Quota exceeded | 429 JSON `{error:'quota_exceeded', dailyLimit}` | none |
| 4 | DB insert user message failed | 500 JSON | none |
| 5 | Embed 5xx after retry | 500 JSON `{error:'embed_failed'}` | delete user message |
| 6 | RPC error | 500 JSON | delete user message |
| 7 | Retrieval empty (not a failure) | Short-circuit stream with fallback | none |
| 8 | History fetch DB error | Log warning, continue with `history=[]` | none |
| 9 | `buildChatMessages` throw (bug) | 500 JSON | delete user message |
| 10 init | Gemini 401 / bad API key | 500 JSON | delete user message |
| 10 mid-stream | Gemini timeout / error | onError writes `\n\n[Lỗi kết nối, vui lòng thử lại]` + finishes. Persist partial only if text ≥50 chars. **User message stays.** | keep user msg |
| Client disconnect | AbortController | `onFinish` does not run; do not persist assistant. User message stays for retry. | keep user msg |
| `onFinish` DB insert assistant failed | Log; client already saw the answer this session | log only |

**Prompt injection posture:**
- Chunk content is trusted (uploaded by user or admin, ingested via Plan 2).
- User question is passed only into `messages[].content` (`user` role), never spliced into system prompt.
- Question length capped 2000 chars server-side; textarea capped client-side.
- No heuristic "ignore previous instructions" warning logger (YAGNI).

**Rendering safety:**
- Assistant text rendered as plain text with `whitespace-pre-wrap` (no markdown parser, no `dangerouslySetInnerHTML`).
- `[n]` markers replaced by React spans, not string interpolation.
- Snippet modal also plain-text.

## 8. Retrieval configuration

| Constant | Value | Why |
|---|---|---|
| `MATCH_COUNT` | 6 | Balances coverage of multi-clause questions (mức phạt xe máy vs ô tô) against prompt size. |
| `MIN_SIMILARITY` | 0.5 | Reasonable cosine threshold for Vietnamese `gemini-embedding-001` output. Tune when we have real query logs. |
| `HISTORY_LIMIT` | 6 (3 pairs) | Multi-turn follow-ups are typically 1-2 turns; 3 is a safe buffer at trivial token cost. |
| `DAILY_QUESTION_LIMIT` | 50 | From spec §7.3; already in `QuotaService`. |
| `QUESTION_MAX_CHARS` | 2000 | Guard against pathological input; textarea `maxLength` also enforces. |

## 9. Testing strategy

### 9.1 Unit (`test/unit/lib/rag/`, `test/unit/lib/services/`)

| File | Tests |
|---|---|
| `retrieve.test.ts` | Filters below-threshold chunks; empty on RPC empty; enriches `documentTitle`; throws on RPC error. Mock chained `client.rpc()` + `client.from('documents').select().in()`. |
| `prompt.test.ts` | Builds `[n] (Điều 5, Khoản 2, Doc) content`; skips null label parts; prepends history; empty history → user-only. Pure fn, no mocks. |
| `citations.test.ts` | Parses markers in first-appearance order; dedupes repeats; skips out-of-range; truncates snippet at word boundary; empty text → `[]`. |
| `ConversationService.test.ts` | `list` ordered by `updated_at desc`; `create` inserts with default title; `rename` throws when not owned; `getRecentMessages` oldest→newest, N-limited, no citations; `appendMessage` writes citations JSON. |

### 9.2 Integration (`test/integration/`)

- `rag.integration.test.ts` — gated by `RUN_INTEGRATION=1`:
  1. Seed 1 document + 3 chunks (real 768-dim embeddings via `GeminiEmbedder`) with fixed `dieu`, `khoan`.
  2. Create a conversation.
  3. Directly invoke the `/api/chat` route handler with a request whose question maps to the seeded chunks.
  4. Assert: response streams text; stream contains `data-citations` part with ≥1 Citation matching a seeded chunk; `messages` table has 2 new rows (user + assistant); `usage_daily.question_count = 1`.
  5. Cleanup: delete conversation (cascades messages), delete chunks + document.
  6. Uses `// @vitest-environment node` pragma (jsdom is project default).

### 9.3 Not tested

- Vercel AI SDK internals — trust upstream.
- Gemini API responses inside unit tests — mock at module boundary (`generateText`/`streamText`).
- RLS policies — covered by Plan 1 tests.
- React component rendering — verified manually in-browser. Playwright deferred to Plan 4.

### 9.4 Manual browser smoke gate (before closing plan)

Login → upload a real Vietnamese law PDF (`sample-law.txt` fixture works too) → wait for `status='ready'` → ask a question about content in that doc → verify:
1. Text streams token-by-token.
2. Answer contains `[n]` markers.
3. Pill row appears below the assistant bubble.
4. Clicking a pill opens the modal with the correct snippet + document title.
5. Composer counter decrements ("X câu/ngày còn lại").
6. Reload page → conversation + messages persist.

## 10. Observability

Each `/api/chat` request logs one structured line at completion:

```
{ requestId, userId, conversationId, retrievedCount, topSimilarity, tokensIn, tokensOut, latencyMs, status }
```

- `requestId`: crypto UUID generated at handler start.
- `topSimilarity`: `retrieved[0]?.similarity ?? null`.
- `tokensIn` / `tokensOut`: read from `streamText`'s `usage` in `onFinish`.
- `status`: `success` | `quota_exceeded` | `embed_failed` | `retrieve_failed` | `stream_error` | `unauthorized` | `forbidden`.

Emitted via `console.log(JSON.stringify(...))` (Vercel picks up structured logs).

## 11. Success gates (definition of done)

- All unit tests + integration test pass.
- `tsc --noEmit` clean.
- Manual browser smoke passes on all 6 checks.
- No regression: `npm run test` still 51+ passing.
- Commit history is per-task with a review markdown for each task (matches Plan 2 convention).
