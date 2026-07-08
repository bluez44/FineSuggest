# Plan 3 — RAG Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the RAG chat surface on top of the Plan 2 ingestion corpus: user asks a Vietnamese traffic-law question, we retrieve the top chunks, stream a strictly grounded answer with inline `[n]` citations, and render clickable pills that reveal source snippets.

**Architecture:** Function-based module in `src/lib/rag/` (`retrieve`, `prompt`, `citations`, `systemPrompt`) — no pipeline class. Orchestration lives in `src/app/api/chat/route.ts`, streaming via Vercel AI SDK v7 standalone helpers (`streamText` + `toUIMessageStream` + `createUIMessageStream` + `createUIMessageStreamResponse`). Client uses `useChat` from `@ai-sdk/react`. Conversation CRUD via a small `ConversationService` behind thin route handlers. Chat UI is a client shell with sidebar + main pane + citation modal, mounted under the existing `(app)/layout.tsx` AppShell.

**Tech Stack:**
- Next.js 16 App Router, React 19, TypeScript strict
- Vercel AI SDK v7 (`ai@7.0.8`) — standalone `createUIMessageStream` / `toUIMessageStream` / `createUIMessageStreamResponse` (do NOT use deprecated `result.toUIMessageStreamResponse()`)
- `@ai-sdk/google@4.0.3` (already installed) — provider factory `google('gemini-2.5-flash')`
- `@ai-sdk/react` — installed in Task 8; provides `useChat` (v7-era package split from `ai`)
- Supabase Postgres + pgvector + Auth (existing from Plans 1 + 2)
- `gemini-embedding-001` at 768-dim via existing `GeminiEmbedder`
- shadcn/ui + Tailwind CSS v4 + sonner (all installed)
- Vitest — jsdom project default, `// @vitest-environment node` per file for Node-only tests

## Global Constraints

Every task inherits these — do not violate without explicit note.

- **Chat model:** `gemini-2.5-flash` (constant, one place: the route handler).
- **Retrieval config:** `MATCH_COUNT = 6`, `MIN_SIMILARITY = 0.5`, `HISTORY_LIMIT = 6` (3 Q&A pairs).
- **Quota:** `DAILY_QUESTION_LIMIT = 50`; short-circuit responses do **not** refund quota (spec decision H2).
- **Question length cap:** 2000 chars server-side; textarea `maxLength={2000}` client-side.
- **UI copy:** Vietnamese for all user-facing strings (error messages, buttons, placeholders, badges).
- **Client-vs-admin Supabase client:** user-scoped (`createServerClient()`) for `/api/conversations/**` routes; admin service-role client (`createClient<Database>(URL, SERVICE_ROLE_KEY)`) for `/api/chat` (writes `usage_daily`).
- **Vercel AI SDK usage:** use the standalone helpers (`createUIMessageStream`, `toUIMessageStream`, `createUIMessageStreamResponse`). Deprecated `result.toUIMessageStreamResponse()` is banned in new code.
- **Assistant rendering:** plain text with `whitespace-pre-wrap` — no markdown parser, no `dangerouslySetInnerHTML`. `[n]` markers replaced by React spans.
- **YAGNI cuts (do NOT implement):** question rewriting, lazy title generation, Upstash Ratelimit middleware, reranker, PDF viewer.
- **Per-task convention:** each task ends with (a) unit tests passing (or manual verification for UI-only tasks), (b) typecheck clean, (c) a per-task commit, (d) a review markdown at `docs/superpowers/reviews/2026-07-08-plan-3-task-N-<slug>.md`. Follow the Plan 2 review-doc structure (What/Why/Files/Verdict).

---

## Task 1: Extend `QuotaService` with `consumeQuestion`

**Files:**
- Modify: `src/lib/services/QuotaService.ts`
- Test: `test/unit/lib/services/QuotaService.consumeQuestion.test.ts`

**Interfaces:**
- Consumes: existing `QuotaService` constructor `(client: SupabaseClient<Database>)`.
- Produces:
  - `DAILY_QUESTION_LIMIT: 50` (exported constant).
  - `QuotaService.consumeQuestion(userId: string): Promise<{ ok: true; remaining: number } | { ok: false; reason: string }>`.

- [ ] **Step 1: Write failing test**

Create `test/unit/lib/services/QuotaService.consumeQuestion.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { QuotaService, DAILY_QUESTION_LIMIT } from '@/lib/services/QuotaService';

function makeClient(upsertResult: { data: { question_count: number } | null; error: unknown }) {
  const single = vi.fn().mockResolvedValue(upsertResult);
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ upsert }));
  return { from } as unknown as Parameters<typeof QuotaService.prototype.consumeQuestion>[0] extends never
    ? never
    : import('@supabase/supabase-js').SupabaseClient;
}

describe('QuotaService.consumeQuestion', () => {
  it('returns ok with remaining count on first request of the day', async () => {
    const client = makeClient({ data: { question_count: 1 }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res).toEqual({ ok: true, remaining: DAILY_QUESTION_LIMIT - 1 });
  });

  it('returns ok with 0 remaining at the limit', async () => {
    const client = makeClient({ data: { question_count: DAILY_QUESTION_LIMIT }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res).toEqual({ ok: true, remaining: 0 });
  });

  it('returns not-ok when limit exceeded', async () => {
    const client = makeClient({ data: { question_count: DAILY_QUESTION_LIMIT + 1 }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/quota/i);
  });

  it('returns not-ok on DB error', async () => {
    const client = makeClient({ data: null, error: { message: 'boom' } });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/lib/services/QuotaService.consumeQuestion.test.ts`
Expected: FAIL — `consumeQuestion is not a function` (and `DAILY_QUESTION_LIMIT` undefined).

- [ ] **Step 3: Implement `consumeQuestion`**

Modify `src/lib/services/QuotaService.ts`. Add the constant, then the method. Full new file contents (existing pieces preserved):

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILES_PER_USER = 10;
export const DAILY_QUESTION_LIMIT = 50;

export type QuotaResult = { ok: true } | { ok: false; reason: string };
export type ConsumeResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: string };

export class QuotaService {
  constructor(private client: SupabaseClient<Database>) {}

  async canUpload(userId: string, fileSizeBytes: number): Promise<QuotaResult> {
    if (fileSizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { ok: false, reason: `File vượt ${MAX_FILE_SIZE_MB} MB` };
    }
    const { count, error } = await this.client
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId);
    if (error) return { ok: false, reason: 'Không kiểm tra được quota' };
    if ((count ?? 0) >= MAX_FILES_PER_USER) {
      return { ok: false, reason: `Đã đạt giới hạn ${MAX_FILES_PER_USER} tài liệu` };
    }
    return { ok: true };
  }

  async consumeQuestion(userId: string): Promise<ConsumeResult> {
    const today = new Date().toISOString().slice(0, 10);

    // Atomic upsert: on conflict, increment via a raw expression.
    // Supabase JS's upsert cannot express `col + 1`, so use RPC-less trick:
    // fetch-then-update in a single call by calling the increment RPC.
    // Alternative that works with only table access: select-then-upsert atomically
    // via server-side merge — Supabase's upsert with default values does NOT
    // atomically increment. To keep this atomic without a DB function, use a
    // Postgres-only path via SQL through client.rpc('increment_usage', {...})
    // — but adding an RPC is a migration.
    //
    // For v1 we implement a two-step read-then-write and accept the small
    // race window: two concurrent requests may both see N and both write N+1,
    // undercounting by 1. Documented in the review doc for Plan 4 hardening.

    const { data: existing, error: selErr } = await this.client
      .from('usage_daily')
      .select('question_count')
      .eq('user_id', userId)
      .eq('day', today)
      .maybeSingle();
    if (selErr) return { ok: false, reason: 'Không đọc được quota' };

    const nextCount = (existing?.question_count ?? 0) + 1;

    const { data, error } = await this.client
      .from('usage_daily')
      .upsert(
        { user_id: userId, day: today, question_count: nextCount },
        { onConflict: 'user_id,day' },
      )
      .select('question_count')
      .single();

    if (error || !data) return { ok: false, reason: 'Không cập nhật được quota' };

    if (data.question_count > DAILY_QUESTION_LIMIT) {
      return { ok: false, reason: `Bạn đã dùng hết ${DAILY_QUESTION_LIMIT} câu hỏi hôm nay` };
    }
    return { ok: true, remaining: DAILY_QUESTION_LIMIT - data.question_count };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/lib/services/QuotaService.consumeQuestion.test.ts`
Expected: PASS 4/4.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; unit-test count grows by 4.

- [ ] **Step 6: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-1-quota-consume.md` (What/Why/Files changed/Verdict/Notes — follow the Plan 2 review-doc structure). Note the read-then-write race window in the "Notes / tech debt" section.

```bash
git add src/lib/services/QuotaService.ts test/unit/lib/services/QuotaService.consumeQuestion.test.ts docs/superpowers/reviews/2026-07-08-plan-3-task-1-quota-consume.md
git commit -m "feat(quota): add QuotaService.consumeQuestion with daily limit"
```

---

## Task 2: `src/lib/rag/systemPrompt.ts` + `src/lib/rag/prompt.ts`

**Files:**
- Create: `src/lib/rag/systemPrompt.ts`
- Create: `src/lib/rag/prompt.ts`
- Test: `test/unit/lib/rag/prompt.test.ts`

**Interfaces:**
- Consumes: `RetrievedChunk` type (declared in Task 4 — for now declare a *local* structural type in this file that mirrors what Task 4 will export; Task 4 replaces it via `import type`).
- Produces:
  - `strictRagSystemPrompt: string`.
  - `HistoryMessage` type.
  - `buildChatMessages(retrieved, history, question)` → `{ system: string; messages: ModelMessage[] }`.

- [ ] **Step 1: Write failing test**

Create `test/unit/lib/rag/prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildChatMessages } from '@/lib/rag/prompt';
import { strictRagSystemPrompt } from '@/lib/rag/systemPrompt';

const chunk = (n: number, over: Partial<{ dieu: string | null; khoan: string | null; diem: string | null; documentTitle: string; content: string }> = {}) => ({
  id: `c${n}`,
  documentId: `d${n}`,
  content: over.content ?? `Nội dung đoạn ${n}`,
  dieu: over.dieu ?? `Điều ${n}`,
  khoan: over.khoan ?? `Khoản 1`,
  diem: over.diem ?? null,
  page: null,
  similarity: 0.9,
  documentTitle: over.documentTitle ?? 'Nghị định 100/2019',
});

describe('buildChatMessages', () => {
  it('embeds the strict-RAG system prompt and lists chunks with [n] markers', () => {
    const { system } = buildChatMessages([chunk(1), chunk(2)], [], 'Vượt đèn đỏ phạt bao nhiêu?');
    expect(system.startsWith(strictRagSystemPrompt)).toBe(true);
    expect(system).toContain('CONTEXT:');
    expect(system).toContain('[1] (Điều 1, Khoản 1, Nghị định 100/2019)');
    expect(system).toContain('[2] (Điều 2, Khoản 1, Nghị định 100/2019)');
  });

  it('omits null label parts (no khoan / diem)', () => {
    const c = chunk(5, { khoan: null, diem: null });
    const { system } = buildChatMessages([c], [], 'Hỏi');
    expect(system).toContain('[1] (Điều 5, Nghị định 100/2019)');
    expect(system).not.toContain('Khoản');
    expect(system).not.toContain('Điểm');
  });

  it('prepends history messages before the new user question', () => {
    const { messages } = buildChatMessages(
      [chunk(1)],
      [
        { role: 'user', content: 'Câu 1' },
        { role: 'assistant', content: 'Trả lời 1' },
      ],
      'Câu mới',
    );
    expect(messages).toEqual([
      { role: 'user', content: 'Câu 1' },
      { role: 'assistant', content: 'Trả lời 1' },
      { role: 'user', content: 'Câu mới' },
    ]);
  });

  it('empty history → messages has only the new user question', () => {
    const { messages } = buildChatMessages([chunk(1)], [], 'Chỉ có câu này');
    expect(messages).toEqual([{ role: 'user', content: 'Chỉ có câu này' }]);
  });

  it('handles empty retrieved (still returns valid system with CONTEXT block empty)', () => {
    const { system } = buildChatMessages([], [], 'Câu hỏi');
    expect(system).toContain(strictRagSystemPrompt);
    expect(system).toContain('CONTEXT:');
    expect(system.replace(strictRagSystemPrompt, '').trim().split('\n').every((l) => l === 'CONTEXT:' || l === '')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/lib/rag/prompt.test.ts`
Expected: FAIL — modules `@/lib/rag/prompt` and `@/lib/rag/systemPrompt` do not exist.

- [ ] **Step 3: Create `systemPrompt.ts`**

Create `src/lib/rag/systemPrompt.ts`:

```typescript
export const strictRagSystemPrompt = `Bạn là trợ lý pháp luật giao thông Việt Nam. CHỈ trả lời dựa trên các đoạn trích trong phần CONTEXT bên dưới. Tuyệt đối không suy đoán, không bổ sung kiến thức ngoài context.

Nếu CONTEXT không đủ thông tin để trả lời, hãy nói:
"Tôi không tìm thấy nội dung này trong tài liệu hiện có."

Khi trích dẫn, dùng marker [n] tương ứng với số thứ tự đoạn trong CONTEXT. Trả lời ngắn gọn, rõ ràng, đúng pháp lý.`;
```

- [ ] **Step 4: Create `prompt.ts`**

Create `src/lib/rag/prompt.ts`:

```typescript
import type { ModelMessage } from 'ai';
import { strictRagSystemPrompt } from './systemPrompt';

// Structural type shared with retrieve.ts (declared here to avoid a hard
// import cycle; retrieve.ts declares the canonical RetrievedChunk).
export interface ChunkForPrompt {
  content: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  documentTitle: string;
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function labelParts(c: ChunkForPrompt): string {
  return [c.dieu, c.khoan, c.diem, c.documentTitle]
    .filter((p): p is string => p !== null && p !== undefined && p.length > 0)
    .join(', ');
}

function formatChunk(n: number, c: ChunkForPrompt): string {
  return `[${n}] (${labelParts(c)}) ${c.content}`;
}

export function buildChatMessages(
  retrieved: ChunkForPrompt[],
  history: HistoryMessage[],
  question: string,
): { system: string; messages: ModelMessage[] } {
  const contextBody = retrieved.map((c, i) => formatChunk(i + 1, c)).join('\n\n');
  const system = `${strictRagSystemPrompt}\n\nCONTEXT:\n${contextBody}`;

  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ];

  return { system, messages };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/unit/lib/rag/prompt.test.ts`
Expected: PASS 5/5.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-2-prompt-builder.md`.

```bash
git add src/lib/rag/systemPrompt.ts src/lib/rag/prompt.ts test/unit/lib/rag/prompt.test.ts docs/superpowers/reviews/2026-07-08-plan-3-task-2-prompt-builder.md
git commit -m "feat(rag): strict-RAG system prompt + buildChatMessages"
```

---

## Task 3: `src/lib/rag/citations.ts` — `parseCitations`

**Files:**
- Create: `src/lib/rag/citations.ts`
- Test: `test/unit/lib/rag/citations.test.ts`

**Interfaces:**
- Consumes: `ChunkForPrompt` shape (adds `id`, `documentId`, `page` for the citation output). Task 4's `RetrievedChunk` is a superset.
- Produces:
  - `Citation` type: `{ chunkId, documentId, dieu, khoan, diem, page, documentTitle, snippet, markerIndex }`.
  - `parseCitations(assistantText: string, retrieved: RetrievedChunk[]): Citation[]`.

- [ ] **Step 1: Write failing test**

Create `test/unit/lib/rag/citations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseCitations } from '@/lib/rag/citations';

const chunk = (n: number, over: Partial<{ content: string }> = {}) => ({
  id: `c${n}`,
  documentId: `d${n}`,
  content: over.content ?? `Đây là nội dung đoạn ${n} rất dài ${'.'.repeat(20)}`,
  dieu: `Điều ${n}`,
  khoan: `Khoản 1`,
  diem: null,
  page: null,
  similarity: 0.9,
  documentTitle: `Doc ${n}`,
});

describe('parseCitations', () => {
  it('returns citations in first-appearance order', () => {
    const chunks = [chunk(1), chunk(2), chunk(3)];
    const text = 'Theo [2] và [1] và lại [2] rồi [3].';
    const res = parseCitations(text, chunks);
    expect(res.map((c) => c.markerIndex)).toEqual([2, 1, 3]);
    expect(res.map((c) => c.chunkId)).toEqual(['c2', 'c1', 'c3']);
  });

  it('dedupes repeated markers', () => {
    const chunks = [chunk(1), chunk(2)];
    const text = '[1] và [1] rồi [1] cuối cùng.';
    const res = parseCitations(text, chunks);
    expect(res).toHaveLength(1);
    expect(res[0].markerIndex).toBe(1);
  });

  it('skips out-of-range markers silently', () => {
    const chunks = [chunk(1)];
    const text = 'Theo [1] và [99] không tồn tại.';
    const res = parseCitations(text, chunks);
    expect(res).toHaveLength(1);
    expect(res[0].markerIndex).toBe(1);
  });

  it('truncates snippet to <= 300 chars at word boundary', () => {
    const longContent = 'câu này ' + 'lorem ipsum '.repeat(50);
    const chunks = [{ ...chunk(1), content: longContent }];
    const res = parseCitations('[1]', chunks);
    expect(res[0].snippet.length).toBeLessThanOrEqual(300);
    // No trailing partial word: last char is not a space and preceded by a full word.
    expect(res[0].snippet).not.toMatch(/\s\S{0,2}$/);
  });

  it('returns empty array when no markers present', () => {
    const chunks = [chunk(1)];
    const res = parseCitations('Câu trả lời không có marker.', chunks);
    expect(res).toEqual([]);
  });

  it('returns empty array on empty text', () => {
    const res = parseCitations('', [chunk(1)]);
    expect(res).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/lib/rag/citations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `citations.ts`**

Create `src/lib/rag/citations.ts`:

```typescript
export interface CitationSourceChunk {
  id: string;
  documentId: string;
  content: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  page: number | null;
  documentTitle: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  page: number | null;
  documentTitle: string;
  snippet: string;
  markerIndex: number;
}

const MARKER_RE = /\[(\d+)\]/g;
const SNIPPET_MAX = 300;

function truncateSnippet(content: string): string {
  if (content.length <= SNIPPET_MAX) return content;
  const raw = content.slice(0, SNIPPET_MAX);
  const lastSpace = raw.lastIndexOf(' ');
  return lastSpace > SNIPPET_MAX - 60 ? raw.slice(0, lastSpace) : raw;
}

export function parseCitations(
  assistantText: string,
  retrieved: CitationSourceChunk[],
): Citation[] {
  if (!assistantText) return [];
  const seen = new Set<number>();
  const out: Citation[] = [];
  for (const match of assistantText.matchAll(MARKER_RE)) {
    const n = Number.parseInt(match[1], 10);
    if (seen.has(n)) continue;
    const source = retrieved[n - 1];
    if (!source) continue;
    seen.add(n);
    out.push({
      chunkId: source.id,
      documentId: source.documentId,
      dieu: source.dieu,
      khoan: source.khoan,
      diem: source.diem,
      page: source.page,
      documentTitle: source.documentTitle,
      snippet: truncateSnippet(source.content),
      markerIndex: n,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/lib/rag/citations.test.ts`
Expected: PASS 6/6.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-3-citations.md`.

```bash
git add src/lib/rag/citations.ts test/unit/lib/rag/citations.test.ts docs/superpowers/reviews/2026-07-08-plan-3-task-3-citations.md
git commit -m "feat(rag): parseCitations extracts [n] markers into structured citations"
```

---

## Task 4: `src/lib/rag/retrieve.ts` — `retrieveChunks`

**Files:**
- Create: `src/lib/rag/retrieve.ts`
- Test: `test/unit/lib/rag/retrieve.test.ts`
- Modify: `src/lib/rag/prompt.ts` (replace local `ChunkForPrompt` with `import type { RetrievedChunk }` — the shape is a superset)

**Interfaces:**
- Consumes: `SupabaseClient<Database>`, `match_chunks` RPC (already migrated in Plan 1 — `supabase/migrations/0005_match_chunks_rpc.sql`).
- Produces:
  - `RetrievedChunk` = `CitationSourceChunk & { similarity: number }`.
  - `MIN_SIMILARITY = 0.5` and `MATCH_COUNT = 6` constants.
  - `retrieveChunks(queryEmbedding: number[], userId: string, client: SupabaseClient<Database>): Promise<RetrievedChunk[]>`.

The generated `Database` type currently has an empty `Functions` block (Supabase types gen didn't pick up the RPC). Cast the RPC call return via a local type — don't attempt to regenerate types here.

- [ ] **Step 1: Write failing test**

Create `test/unit/lib/rag/retrieve.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { retrieveChunks, MIN_SIMILARITY } from '@/lib/rag/retrieve';

function makeClient(rpcRes: { data: unknown; error: unknown }, docsRes?: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcRes);
  const inFn = vi.fn().mockResolvedValue(docsRes ?? { data: [], error: null });
  const selectDocs = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select: selectDocs }));
  return { rpc, from } as never;
}

describe('retrieveChunks', () => {
  it('filters chunks with similarity below MIN_SIMILARITY', async () => {
    const rows = [
      { id: 'a', document_id: 'd1', content: 'ok', dieu: 'Điều 1', khoan: null, diem: null, page: null, similarity: 0.9 },
      { id: 'b', document_id: 'd1', content: 'low', dieu: 'Điều 2', khoan: null, diem: null, page: null, similarity: 0.3 },
    ];
    const client = makeClient(
      { data: rows, error: null },
      { data: [{ id: 'd1', title: 'Doc 1' }], error: null },
    );
    const res = await retrieveChunks([0.1, 0.2], 'user-1', client);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('a');
    expect(res[0].similarity).toBeGreaterThanOrEqual(MIN_SIMILARITY);
    expect(res[0].documentTitle).toBe('Doc 1');
  });

  it('returns [] on RPC empty', async () => {
    const client = makeClient({ data: [], error: null });
    const res = await retrieveChunks([0.1, 0.2], 'user-1', client);
    expect(res).toEqual([]);
  });

  it('throws on RPC error', async () => {
    const client = makeClient({ data: null, error: { message: 'boom' } });
    await expect(retrieveChunks([0.1, 0.2], 'user-1', client)).rejects.toThrow(/boom|retrieve/i);
  });

  it('enriches documentTitle from the documents.select().in() second query', async () => {
    const rows = [
      { id: 'a', document_id: 'd1', content: 'x', dieu: null, khoan: null, diem: null, page: null, similarity: 0.9 },
      { id: 'b', document_id: 'd2', content: 'y', dieu: null, khoan: null, diem: null, page: null, similarity: 0.85 },
    ];
    const client = makeClient(
      { data: rows, error: null },
      { data: [{ id: 'd1', title: 'One' }, { id: 'd2', title: 'Two' }], error: null },
    );
    const res = await retrieveChunks([0], 'user-1', client);
    expect(res.map((r) => r.documentTitle).sort()).toEqual(['One', 'Two']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/lib/rag/retrieve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `retrieve.ts`**

Create `src/lib/rag/retrieve.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { CitationSourceChunk } from './citations';

export const MIN_SIMILARITY = 0.5;
export const MATCH_COUNT = 6;

export interface RetrievedChunk extends CitationSourceChunk {
  similarity: number;
}

// The generated Database type has an empty Functions block, so the RPC's
// return type is inferred as `any` (or unknown after strict). Declare the
// shape explicitly here and cast — the RPC itself is defined in
// supabase/migrations/0005_match_chunks_rpc.sql.
interface RpcRow {
  id: string;
  document_id: string;
  content: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  page: number | null;
  similarity: number;
}

export async function retrieveChunks(
  queryEmbedding: number[],
  userId: string,
  client: SupabaseClient<Database>,
): Promise<RetrievedChunk[]> {
  // 1. Call RPC.
  const { data, error } = await (client.rpc as unknown as (
    fn: string,
    args: { query_embedding: number[]; match_count: number; caller_user_id: string },
  ) => Promise<{ data: RpcRow[] | null; error: { message: string } | null }>)(
    'match_chunks',
    {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
      caller_user_id: userId,
    },
  );
  if (error) throw new Error(`retrieve failed: ${error.message}`);
  const rows = (data ?? []).filter((r) => r.similarity >= MIN_SIMILARITY);
  if (rows.length === 0) return [];

  // 2. Enrich with document title (RPC does not join documents).
  const docIds = Array.from(new Set(rows.map((r) => r.document_id)));
  const { data: docs, error: docErr } = await client
    .from('documents')
    .select('id, title')
    .in('id', docIds);
  if (docErr) throw new Error(`title enrichment failed: ${docErr.message}`);

  const titleById = new Map<string, string>();
  for (const d of docs ?? []) titleById.set(d.id, d.title);

  return rows.map<RetrievedChunk>((r) => ({
    id: r.id,
    documentId: r.document_id,
    content: r.content,
    dieu: r.dieu,
    khoan: r.khoan,
    diem: r.diem,
    page: r.page,
    similarity: r.similarity,
    documentTitle: titleById.get(r.document_id) ?? '(Không rõ tài liệu)',
  }));
}
```

- [ ] **Step 4: Update `prompt.ts` to use `RetrievedChunk`**

Modify `src/lib/rag/prompt.ts` — swap the local `ChunkForPrompt` for the canonical import:

Replace the block `export interface ChunkForPrompt { ... }` with:

```typescript
import type { RetrievedChunk } from './retrieve';

export type ChunkForPrompt = Pick<
  RetrievedChunk,
  'content' | 'dieu' | 'khoan' | 'diem' | 'documentTitle'
>;
```

(Keep the `ChunkForPrompt` name so tests and other callers stay stable; the alias just narrows `RetrievedChunk`.)

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run test/unit/lib/rag/ && npx tsc --noEmit`
Expected: all rag/* tests pass; no type errors.

- [ ] **Step 6: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-4-retrieve.md`. Note in "Tech debt": generated Database types have empty Functions block; RPC return shape is asserted locally. Regenerate types once Supabase CLI is available in a future task.

```bash
git add src/lib/rag/retrieve.ts src/lib/rag/prompt.ts test/unit/lib/rag/retrieve.test.ts docs/superpowers/reviews/2026-07-08-plan-3-task-4-retrieve.md
git commit -m "feat(rag): retrieveChunks calls match_chunks RPC + enriches title"
```

---

## Task 5: `ConversationService`

**Files:**
- Create: `src/lib/services/ConversationService.ts`
- Test: `test/unit/lib/services/ConversationService.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient<Database>`; `Citation` from `src/lib/rag/citations.ts`.
- Produces the class with methods listed below.

- [ ] **Step 1: Write failing test**

Create `test/unit/lib/services/ConversationService.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ConversationService } from '@/lib/services/ConversationService';

function chain(final: unknown) {
  const p: Record<string, unknown> = {};
  const attach = (name: string, ret: unknown = p) => (p[name] = vi.fn(() => ret));
  attach('select'); attach('insert'); attach('update'); attach('delete');
  attach('eq'); attach('order'); attach('limit'); attach('lt'); attach('neq');
  attach('in'); attach('single', final); attach('maybeSingle', final);
  return p;
}

describe('ConversationService', () => {
  it('list orders by updated_at desc, returns camelCase rows', async () => {
    const rows = [
      { id: 'c1', title: 't1', updated_at: '2026-07-08T10:00:00Z' },
      { id: 'c2', title: 't2', updated_at: '2026-07-08T09:00:00Z' },
    ];
    const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: rows, error: null }) }));
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ order: () => Promise.resolve({ data: rows, error: null }) })) }));
    const from = vi.fn(() => ({ select }));
    const svc = new ConversationService({ from } as never);
    const res = await svc.list('user-1');
    expect(res).toEqual([
      { id: 'c1', title: 't1', updatedAt: '2026-07-08T10:00:00Z' },
      { id: 'c2', title: 't2', updatedAt: '2026-07-08T09:00:00Z' },
    ]);
  });

  it('create inserts row and returns id + default title', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'c-new', title: 'Cuộc trò chuyện mới' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const svc = new ConversationService({ from } as never);
    const res = await svc.create('user-1');
    expect(res.id).toBe('c-new');
    expect(res.title).toBe('Cuộc trò chuyện mới');
    expect(insert).toHaveBeenCalledWith({ owner_id: 'user-1' });
  });

  it('rename throws when no row updated (not owned or not found)', async () => {
    const eqOwner = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
    const eqId = vi.fn(() => ({ eq: eqOwner }));
    const update = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ update }));
    const svc = new ConversationService({ from } as never);
    await expect(svc.rename('c-x', 'user-1', 'new title')).rejects.toThrow(/not found|owned/i);
  });

  it('getRecentMessages returns role+content only, oldest→newest, N-limited', async () => {
    const rows = [
      { role: 'assistant', content: 'A2', created_at: '2026-07-08T09:02:00Z' },
      { role: 'user', content: 'Q2', created_at: '2026-07-08T09:01:00Z' },
      { role: 'assistant', content: 'A1', created_at: '2026-07-08T09:00:30Z' },
      { role: 'user', content: 'Q1', created_at: '2026-07-08T09:00:00Z' },
    ];
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const svc = new ConversationService({ from } as never);
    const res = await svc.getRecentMessages('c-1', 4);
    expect(res).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
      { role: 'assistant', content: 'A2' },
    ]);
  });

  it('appendMessage writes role + content + citations JSONB, returns new id', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'm-new' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const svc = new ConversationService({ from } as never);
    const citations = [{ chunkId: 'x', documentId: 'd', dieu: null, khoan: null, diem: null, page: null, documentTitle: 'T', snippet: 's', markerIndex: 1 }];
    const res = await svc.appendMessage('c-1', 'assistant', 'hello', citations);
    expect(res.id).toBe('m-new');
    expect(insert).toHaveBeenCalledWith({
      conversation_id: 'c-1',
      role: 'assistant',
      content: 'hello',
      citations,
    });
  });

  it('ownedBy returns true when exists, false when null', async () => {
    const maybeSingleTrue = vi.fn().mockResolvedValue({ data: { id: 'c-1' }, error: null });
    const eqOwnerT = vi.fn(() => ({ maybeSingle: maybeSingleTrue }));
    const eqIdT = vi.fn(() => ({ eq: eqOwnerT }));
    const selectT = vi.fn(() => ({ eq: eqIdT }));
    const fromT = vi.fn(() => ({ select: selectT }));
    const svcT = new ConversationService({ from: fromT } as never);
    expect(await svcT.ownedBy('c-1', 'u-1')).toBe(true);

    const maybeSingleFalse = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqOwnerF = vi.fn(() => ({ maybeSingle: maybeSingleFalse }));
    const eqIdF = vi.fn(() => ({ eq: eqOwnerF }));
    const selectF = vi.fn(() => ({ eq: eqIdF }));
    const fromF = vi.fn(() => ({ select: selectF }));
    const svcF = new ConversationService({ from: fromF } as never);
    expect(await svcF.ownedBy('c-1', 'u-1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/lib/services/ConversationService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ConversationService.ts`**

Create `src/lib/services/ConversationService.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { Citation } from '@/lib/rag/citations';
import type { HistoryMessage } from '@/lib/rag/prompt';

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: string;
}

export class ConversationService {
  constructor(private client: SupabaseClient<Database>) {}

  async list(userId: string): Promise<ConversationSummary[]> {
    const { data, error } = await this.client
      .from('conversations')
      .select('id, title, updated_at')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`list conversations failed: ${error.message}`);
    return (data ?? []).map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
  }

  async create(userId: string): Promise<{ id: string; title: string }> {
    const { data, error } = await this.client
      .from('conversations')
      .insert({ owner_id: userId })
      .select('id, title')
      .single();
    if (error || !data) throw new Error(`create conversation failed: ${error?.message ?? 'no data'}`);
    return { id: data.id, title: data.title };
  }

  async rename(id: string, userId: string, title: string): Promise<void> {
    const { data, error } = await this.client
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', userId)
      .select('id');
    if (error) throw new Error(`rename failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('conversation not found or not owned');
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId);
    if (error) throw new Error(`delete failed: ${error.message}`);
  }

  async getMessages(id: string, userId: string): Promise<StoredMessage[]> {
    // Ownership check via join filter: RLS or explicit .eq('owner_id') on parent.
    const owned = await this.ownedBy(id, userId);
    if (!owned) throw new Error('conversation not found or not owned');
    const { data, error } = await this.client
      .from('messages')
      .select('id, role, content, citations, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`get messages failed: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      citations: (r.citations as unknown as Citation[]) ?? [],
      createdAt: r.created_at,
    }));
  }

  async getRecentMessages(id: string, limit: number): Promise<HistoryMessage[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`get recent messages failed: ${error.message}`);
    // DB returns newest→oldest; we want oldest→newest for prompt order.
    return (data ?? [])
      .slice()
      .reverse()
      .map((r) => ({ role: r.role, content: r.content }));
  }

  async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    citations?: Citation[],
  ): Promise<{ id: string }> {
    const payload: {
      conversation_id: string;
      role: 'user' | 'assistant';
      content: string;
      citations?: Json;
    } = { conversation_id: conversationId, role, content };
    if (citations && citations.length > 0) payload.citations = citations as unknown as Json;

    const { data, error } = await this.client
      .from('messages')
      .insert(payload)
      .select('id')
      .single();
    if (error || !data) throw new Error(`append message failed: ${error?.message ?? 'no data'}`);
    return { id: data.id };
  }

  async deleteMessage(id: string): Promise<void> {
    const { error } = await this.client.from('messages').delete().eq('id', id);
    if (error) throw new Error(`delete message failed: ${error.message}`);
  }

  async ownedBy(id: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw new Error(`ownership check failed: ${error.message}`);
    return data !== null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/lib/services/ConversationService.test.ts`
Expected: PASS 6/6. If tests fail on chain shape, the mock helpers may not match — adjust the mocks so each call chain in the implementation resolves correctly. Do not change the implementation to match a bad mock.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-5-conversation-service.md`.

```bash
git add src/lib/services/ConversationService.ts test/unit/lib/services/ConversationService.test.ts docs/superpowers/reviews/2026-07-08-plan-3-task-5-conversation-service.md
git commit -m "feat(services): ConversationService (list/create/rename/delete/messages/append/ownedBy)"
```

---

## Task 6: Conversation CRUD API routes

**Files:**
- Create: `src/app/api/conversations/route.ts` (GET list + POST create)
- Create: `src/app/api/conversations/[id]/route.ts` (PATCH rename + DELETE)
- Create: `src/app/api/conversations/[id]/messages/route.ts` (GET messages)

**Interfaces:**
- Consumes: `ConversationService`, `createServerClient` (user-scoped RLS client), Supabase `auth.getUser()`.
- Produces: 5 HTTP endpoints. Responses are JSON except 204 for empty successes.

No unit tests for routes (thin orchestration; same convention as Plan 2's `/api/documents`). Verify via manual `curl` in Step 4.

- [ ] **Step 1: Create `src/app/api/conversations/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = new ConversationService(supabase);
  const conversations = await svc.list(user.id);
  return NextResponse.json({ conversations });
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = new ConversationService(supabase);
  const created = await svc.create(user.id);
  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: Create `src/app/api/conversations/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export const runtime = 'nodejs';

const renameSchema = z.object({ title: z.string().min(1).max(200) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid title', issues: parsed.error.issues }, { status: 400 });
  }

  const svc = new ConversationService(supabase);
  try {
    await svc.rename(id, user.id, parsed.data.title);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    const status = /not found|not owned/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const svc = new ConversationService(supabase);
  const owned = await svc.ownedBy(id, user.id);
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await svc.delete(id, user.id);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Create `src/app/api/conversations/[id]/messages/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const svc = new ConversationService(supabase);
  try {
    const messages = await svc.getMessages(id, user.id);
    return NextResponse.json({ messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    const status = /not found|not owned/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 4: Manual smoke via curl**

Start dev server: `npm run dev` (in a separate shell).
In the browser: log in via Google OAuth (this sets the session cookie).
Copy the `sb-<project>-auth-token` cookie (DevTools → Application → Cookies) and use it as `-H "Cookie: <that>"` in curl, OR use the browser's Console `fetch(...)` to hit the routes.

Verify:
- `POST http://localhost:3000/api/conversations` → 201 with `{id, title:"Cuộc trò chuyện mới"}`.
- `GET http://localhost:3000/api/conversations` → 200 with `conversations: [...]` containing the row just created.
- `PATCH http://localhost:3000/api/conversations/<id>` with `{"title":"Test"}` → 204.
- `GET http://localhost:3000/api/conversations` → new title reflected.
- `GET http://localhost:3000/api/conversations/<id>/messages` → 200 with `messages: []`.
- `DELETE http://localhost:3000/api/conversations/<id>` → 204.
- `GET http://localhost:3000/api/conversations/<id>/messages` → 404.
- Same endpoints without cookie → 401.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-6-conversation-routes.md`. Include the curl transcript from Step 4 (or a summary) as evidence.

```bash
git add src/app/api/conversations/ docs/superpowers/reviews/2026-07-08-plan-3-task-6-conversation-routes.md
git commit -m "feat(api): conversation CRUD routes (list/create/rename/delete/messages)"
```

---

## Task 7: `POST /api/chat` route handler (the RAG orchestrator)

**Files:**
- Create: `src/app/api/chat/route.ts`
- Test: `test/unit/app/api/chat/route.test.ts`

**Interfaces:**
- Consumes: `createServerClient` (only to read the user id from session), admin `createClient<Database>(URL, SERVICE_ROLE_KEY)` for all mutation work, `QuotaService.consumeQuestion`, `ConversationService`, `GeminiEmbedder`, `retrieveChunks`, `buildChatMessages`, `parseCitations`, `strictRagSystemPrompt`, `streamText`, `createUIMessageStream`, `toUIMessageStream`, `createUIMessageStreamResponse` from `ai`, `google` from `@ai-sdk/google`.
- Produces: `POST /api/chat` handler.

- [ ] **Step 1: Write failing test**

Create `test/unit/app/api/chat/route.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks. These modules are dynamically imported by the route.
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
  })),
}));

const mockConsume = vi.fn();
const mockOwnedBy = vi.fn();
const mockCreate = vi.fn();
const mockAppend = vi.fn();
const mockDeleteMessage = vi.fn();
const mockGetRecent = vi.fn();
const mockEmbed = vi.fn();
const mockRetrieve = vi.fn();
const mockStreamText = vi.fn();

vi.mock('@/lib/services/QuotaService', () => ({
  DAILY_QUESTION_LIMIT: 50,
  QuotaService: vi.fn().mockImplementation(() => ({ consumeQuestion: mockConsume })),
}));
vi.mock('@/lib/services/ConversationService', () => ({
  ConversationService: vi.fn().mockImplementation(() => ({
    ownedBy: mockOwnedBy,
    create: mockCreate,
    appendMessage: mockAppend,
    deleteMessage: mockDeleteMessage,
    getRecentMessages: mockGetRecent,
  })),
}));
vi.mock('@/lib/ingestion/embedder/GeminiEmbedder', () => ({
  GeminiEmbedder: vi.fn().mockImplementation(() => ({ embedBatch: mockEmbed })),
}));
vi.mock('@/lib/rag/retrieve', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/rag/retrieve');
  return { ...actual, retrieveChunks: (...args: unknown[]) => mockRetrieve(...args) };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('ai', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('ai');
  return { ...actual, streamText: (...args: unknown[]) => mockStreamText(...args) };
});

let mockUser: { id: string } | null = { id: 'u-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 'u-1' };
  mockOwnedBy.mockResolvedValue(true);
  mockCreate.mockResolvedValue({ id: 'c-new', title: 'Cuộc trò chuyện mới' });
  mockAppend.mockResolvedValue({ id: 'm-1' });
  mockGetRecent.mockResolvedValue([]);
});

async function callRoute(body: unknown, options?: { conversationId?: string | null }) {
  const { POST } = await import('@/app/api/chat/route');
  return POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/chat', () => {
  it('returns 401 when no session', async () => {
    mockUser = null;
    const res = await callRoute({ messages: [{ role: 'user', content: 'q' }], data: { conversationId: 'c-1' } });
    expect(res.status).toBe(401);
  });

  it('returns 429 when quota exceeded', async () => {
    mockConsume.mockResolvedValue({ ok: false, reason: 'quota' });
    const res = await callRoute({ messages: [{ role: 'user', content: 'q' }], data: { conversationId: 'c-1' } });
    expect(res.status).toBe(429);
  });

  it('returns 403 when conversationId is provided but not owned', async () => {
    mockOwnedBy.mockResolvedValue(false);
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    const res = await callRoute({ messages: [{ role: 'user', content: 'q' }], data: { conversationId: 'c-1' } });
    expect(res.status).toBe(403);
  });

  it('returns 400 when the last user message is empty or too long', async () => {
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    const long = 'x'.repeat(2001);
    const res = await callRoute({ messages: [{ role: 'user', content: long }], data: { conversationId: 'c-1' } });
    expect(res.status).toBe(400);
  });

  it('rolls back the user message when embedding fails', async () => {
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    mockEmbed.mockRejectedValue(new Error('gemini boom'));
    mockAppend.mockResolvedValueOnce({ id: 'm-user' });
    const res = await callRoute({ messages: [{ role: 'user', content: 'q' }], data: { conversationId: 'c-1' } });
    expect(res.status).toBe(500);
    expect(mockDeleteMessage).toHaveBeenCalledWith('m-user');
  });

  it('short-circuits with fallback message when retrieval is empty', async () => {
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);
    mockRetrieve.mockResolvedValue([]);
    mockAppend.mockResolvedValueOnce({ id: 'm-user' }).mockResolvedValueOnce({ id: 'm-assistant' });
    const res = await callRoute({ messages: [{ role: 'user', content: 'q' }], data: { conversationId: 'c-1' } });
    expect(res.status).toBe(200);
    // Second call is the fallback assistant persist.
    const secondCall = mockAppend.mock.calls[1];
    expect(secondCall[1]).toBe('assistant');
    expect(String(secondCall[2])).toMatch(/không tìm thấy/i);
    expect(mockStreamText).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/app/api/chat/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement `src/app/api/chat/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { google } from '@ai-sdk/google';
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { createServerClient } from '@/lib/supabase/server';
import { QuotaService, DAILY_QUESTION_LIMIT } from '@/lib/services/QuotaService';
import { ConversationService } from '@/lib/services/ConversationService';
import { GeminiEmbedder } from '@/lib/ingestion/embedder/GeminiEmbedder';
import { retrieveChunks } from '@/lib/rag/retrieve';
import { buildChatMessages, type HistoryMessage } from '@/lib/rag/prompt';
import { parseCitations, type Citation } from '@/lib/rag/citations';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

const HISTORY_LIMIT = 6;
const QUESTION_MAX_CHARS = 2000;
const CHAT_MODEL = 'gemini-2.5-flash';
const FALLBACK_ANSWER = 'Tôi không tìm thấy nội dung này trong tài liệu hiện có.';

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string() }))
    .min(1),
  data: z
    .object({ conversationId: z.string().uuid().nullable().optional() })
    .optional()
    .default({}),
});

interface LogFields {
  requestId: string;
  userId: string;
  conversationId: string | null;
  retrievedCount: number;
  topSimilarity: number | null;
  status:
    | 'success'
    | 'short_circuit'
    | 'quota_exceeded'
    | 'embed_failed'
    | 'retrieve_failed'
    | 'stream_error'
    | 'unauthorized'
    | 'forbidden'
    | 'bad_request';
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

function log(fields: LogFields): void {
  console.log(JSON.stringify({ scope: 'api.chat', ...fields }));
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = randomUUID();

  // 1. Auth (user-scoped just to read the session).
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    log({ requestId, userId: '-', conversationId: null, retrievedCount: 0, topSimilarity: null, status: 'unauthorized', latencyMs: Date.now() - startedAt });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Parse + validate body.
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    log({ requestId, userId: user.id, conversationId: null, retrievedCount: 0, topSimilarity: null, status: 'bad_request', latencyMs: Date.now() - startedAt });
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser || lastUser.content.trim().length === 0) {
    return NextResponse.json({ error: 'empty question' }, { status: 400 });
  }
  const question = lastUser.content.trim();
  if (question.length > QUESTION_MAX_CHARS) {
    return NextResponse.json({ error: `question exceeds ${QUESTION_MAX_CHARS} chars` }, { status: 400 });
  }

  // 3. Admin (service-role) client — all writes below go through this.
  const admin = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  );
  const conversations = new ConversationService(admin);
  const quota = new QuotaService(admin);

  // 4. Conversation ownership / auto-create.
  let conversationId = parsed.data.data.conversationId ?? null;
  if (conversationId) {
    const owned = await conversations.ownedBy(conversationId, user.id);
    if (!owned) {
      log({ requestId, userId: user.id, conversationId, retrievedCount: 0, topSimilarity: null, status: 'forbidden', latencyMs: Date.now() - startedAt });
      return NextResponse.json({ error: 'conversation not owned' }, { status: 403 });
    }
  } else {
    const created = await conversations.create(user.id);
    conversationId = created.id;
  }

  // 5. Quota.
  const quotaRes = await quota.consumeQuestion(user.id);
  if (!quotaRes.ok) {
    log({ requestId, userId: user.id, conversationId, retrievedCount: 0, topSimilarity: null, status: 'quota_exceeded', latencyMs: Date.now() - startedAt });
    return NextResponse.json({ error: 'quota_exceeded', dailyLimit: DAILY_QUESTION_LIMIT, reason: quotaRes.reason }, { status: 429 });
  }

  // 6. Persist user message.
  const userMsg = await conversations.appendMessage(conversationId, 'user', question);

  // 7. Embed the question. Rollback the user message if embedding fails.
  let embedding: number[];
  try {
    const embedder = new GeminiEmbedder({});
    const vectors = await embedder.embedBatch([question]);
    embedding = vectors[0];
  } catch (err) {
    await conversations.deleteMessage(userMsg.id).catch(() => undefined);
    log({ requestId, userId: user.id, conversationId, retrievedCount: 0, topSimilarity: null, status: 'embed_failed', latencyMs: Date.now() - startedAt });
    return NextResponse.json({ error: 'embed_failed' }, { status: 500 });
  }

  // 8. Retrieve chunks.
  let retrieved;
  try {
    retrieved = await retrieveChunks(embedding, user.id, admin);
  } catch (err) {
    await conversations.deleteMessage(userMsg.id).catch(() => undefined);
    log({ requestId, userId: user.id, conversationId, retrievedCount: 0, topSimilarity: null, status: 'retrieve_failed', latencyMs: Date.now() - startedAt });
    return NextResponse.json({ error: 'retrieve_failed' }, { status: 500 });
  }

  // 9. Short-circuit when nothing above threshold — no LLM call.
  if (retrieved.length === 0) {
    await conversations.appendMessage(conversationId, 'assistant', FALLBACK_ANSWER, []);
    log({ requestId, userId: user.id, conversationId, retrievedCount: 0, topSimilarity: null, status: 'short_circuit', latencyMs: Date.now() - startedAt });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'text-start', id: 'fallback' });
        writer.write({ type: 'text-delta', id: 'fallback', delta: FALLBACK_ANSWER });
        writer.write({ type: 'text-end', id: 'fallback' });
        writer.write({ type: 'data-citations', data: [] as unknown as never });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  // 10. Build prompt with bounded history.
  const history: HistoryMessage[] = await conversations
    .getRecentMessages(conversationId, HISTORY_LIMIT + 1)
    .then((rows) => rows.filter((r) => r.content !== question)) // exclude the msg we just wrote
    .catch(() => []);

  const { system, messages } = buildChatMessages(retrieved, history.slice(-HISTORY_LIMIT), question);
  const topSimilarity = retrieved[0]?.similarity ?? null;
  const capturedConversationId = conversationId;

  // 11. Stream LLM response + inject citations at end.
  const result = streamText({
    model: google(CHAT_MODEL),
    system,
    messages,
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          messageMetadata: () => ({ conversationId: capturedConversationId }),
        }),
      );
      const [text, usage] = await Promise.all([result.text, result.usage]);
      const citations: Citation[] = parseCitations(text, retrieved);
      writer.write({ type: 'data-citations', data: citations as unknown as never });
      await conversations
        .appendMessage(capturedConversationId, 'assistant', text, citations)
        .catch((err) => console.error('assistant persist failed', err));
      log({
        requestId,
        userId: user.id,
        conversationId: capturedConversationId,
        retrievedCount: retrieved.length,
        topSimilarity,
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        status: 'success',
        latencyMs: Date.now() - startedAt,
      });
    },
    onError: (err) => {
      console.error('chat stream error', err);
      log({
        requestId,
        userId: user.id,
        conversationId: capturedConversationId,
        retrievedCount: retrieved.length,
        topSimilarity,
        status: 'stream_error',
        latencyMs: Date.now() - startedAt,
      });
      return 'Lỗi kết nối, vui lòng thử lại.';
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/app/api/chat/route.test.ts`
Expected: PASS 6/6.

If a specific test fails because the mock chain shape does not match how the route imports its dependencies, adjust the mock (not the route). Common gotchas:
- The route imports `retrieveChunks` from `@/lib/rag/retrieve`. The mock uses `importActual` + spreads then overrides — this preserves the constants (`MIN_SIMILARITY`, etc.).
- The route imports `streamText` from `ai`. Same pattern: `importActual` then override.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-7-chat-route.md`. Include the observability log format and the short-circuit behavior in the "Notes" section.

```bash
git add src/app/api/chat/route.ts test/unit/app/api/chat/route.test.ts docs/superpowers/reviews/2026-07-08-plan-3-task-7-chat-route.md
git commit -m "feat(api): POST /api/chat — RAG streaming route with short-circuit + citations"
```

---

## Task 8: Install `@ai-sdk/react`; citation UI components

**Files:**
- Modify: `package.json` (add `@ai-sdk/react`)
- Create: `src/components/chat/MessageBubble.tsx`
- Create: `src/components/chat/CitationPill.tsx`
- Create: `src/components/chat/CitationPreviewModal.tsx`

**Interfaces:**
- Consumes: `useChat`, `UIMessage`, `Citation` type.
- Produces: `<MessageBubble message citations />` client component.

No automated tests — per spec §9.3, React UI is verified in-browser. This task ends with a visual smoke.

- [ ] **Step 1: Install `@ai-sdk/react`**

```bash
npm install @ai-sdk/react
```

Verify: `node -e "console.log(require('@ai-sdk/react/package.json').version)"` prints ≥ 4.0.0.

- [ ] **Step 2: Create `src/components/chat/CitationPreviewModal.tsx`**

```tsx
'use client';

import type { Citation } from '@/lib/rag/citations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  citation: Citation | null;
  onClose: () => void;
}

function labelParts(c: Citation): string {
  return [c.dieu, c.khoan, c.diem].filter((p): p is string => Boolean(p)).join(', ');
}

export function CitationPreviewModal({ citation, onClose }: Props) {
  const open = citation !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trích dẫn nguồn</DialogTitle>
          <DialogDescription>
            {citation ? (
              <span className="text-slate-700">
                {labelParts(citation)}
                {citation.documentTitle ? ` — ${citation.documentTitle}` : ''}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-800">
          {citation?.snippet}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create `src/components/chat/CitationPill.tsx`**

```tsx
'use client';

import type { Citation } from '@/lib/rag/citations';

interface Props {
  citation: Citation;
  onSelect: (c: Citation) => void;
}

function shortLabel(c: Citation): string {
  const parts = [c.dieu, c.khoan, c.diem].filter((p): p is string => Boolean(p));
  const primary = parts.length > 0 ? parts.join(', ') : 'Nguồn';
  return `[${c.markerIndex}] ${primary}`;
}

export function CitationPill({ citation, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(citation)}
      className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:bg-slate-200"
      title={citation.documentTitle}
    >
      {shortLabel(citation)}
    </button>
  );
}
```

- [ ] **Step 4: Create `src/components/chat/MessageBubble.tsx`**

```tsx
'use client';

import { Fragment, useState } from 'react';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { CitationPill } from './CitationPill';
import { CitationPreviewModal } from './CitationPreviewModal';

interface Props {
  message: UIMessage;
  citations: Citation[];
}

const MARKER_RE = /(\[\d+\])/g;

function renderTextWithMarkers(text: string) {
  const segments = text.split(MARKER_RE);
  return segments.map((seg, i) =>
    MARKER_RE.test(seg) ? (
      <span key={i} className="rounded bg-amber-100 px-1 text-amber-900">
        {seg}
      </span>
    ) : (
      <Fragment key={i}>{seg}</Fragment>
    ),
  );
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function MessageBubble({ message, citations }: Props) {
  const [selected, setSelected] = useState<Citation | null>(null);
  const isUser = message.role === 'user';
  const bubbleClass = isUser
    ? 'ml-auto bg-slate-900 text-white'
    : 'mr-auto bg-white text-slate-900 border border-slate-200';

  return (
    <div className="flex flex-col">
      <div className={`max-w-2xl rounded-lg px-4 py-3 whitespace-pre-wrap ${bubbleClass}`}>
        {renderTextWithMarkers(messageText(message))}
      </div>
      {!isUser && citations.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {citations.map((c) => (
            <CitationPill key={c.chunkId + c.markerIndex} citation={c} onSelect={setSelected} />
          ))}
        </div>
      ) : null}
      <CitationPreviewModal citation={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-8-citation-ui.md`.

```bash
git add package.json package-lock.json src/components/chat/MessageBubble.tsx src/components/chat/CitationPill.tsx src/components/chat/CitationPreviewModal.tsx docs/superpowers/reviews/2026-07-08-plan-3-task-8-citation-ui.md
git commit -m "feat(ui): message bubble with citation pill row + preview modal"
```

---

## Task 9: Composer + MessageList + ChatShell (main chat surface)

**Files:**
- Create: `src/components/chat/Composer.tsx`
- Create: `src/components/chat/MessageList.tsx`
- Create: `src/components/chat/ChatShell.tsx`

**Interfaces:**
- Consumes: `useChat` from `@ai-sdk/react`, `Citation` type, MessageBubble.
- Produces: `<ChatShell conversationId initialMessages sidebar />` client component.

- [ ] **Step 1: Create `src/components/chat/Composer.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  remaining?: number | null;
}

const MAX = 2000;

export function Composer({ onSubmit, disabled, remaining }: Props) {
  const [text, setText] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          maxLength={MAX}
          placeholder="Hỏi về luật giao thông…"
          disabled={disabled}
          className="min-h-[52px] flex-1 resize-none"
        />
        <Button type="submit" disabled={disabled || text.trim().length === 0}>
          Gửi
        </Button>
      </div>
      <div className="mt-1 text-right text-xs text-slate-500">
        {remaining !== null && remaining !== undefined
          ? `Còn ${remaining} câu hôm nay`
          : `${text.length}/${MAX}`}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/components/chat/MessageList.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: UIMessage[];
  citationsByMessageId: Record<string, Citation[]>;
}

export function MessageList({ messages, citationsByMessageId }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div ref={ref} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} citations={citationsByMessageId[m.id] ?? []} />
      ))}
      {messages.length === 0 ? (
        <p className="mx-auto max-w-md text-center text-sm text-slate-500">
          Đặt câu hỏi về luật giao thông để bắt đầu.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/chat/ChatShell.tsx`**

```tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

interface Props {
  conversationId: string;
  initialMessages: UIMessage[];
  initialCitationsByMessageId: Record<string, Citation[]>;
  sidebar: ReactNode;
}

export function ChatShell({ conversationId, initialMessages, initialCitationsByMessageId, sidebar }: Props) {
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, data: { conversationId } },
      }),
    }),
    [conversationId],
  );

  const [citationsByMessageId, setCitationsByMessageId] = useState<Record<string, Citation[]>>(
    initialCitationsByMessageId,
  );

  const { messages, sendMessage, status } = useChat<UIMessage>({
    transport,
    messages: initialMessages,
    onData: (part) => {
      // Custom data-citations parts land here as { type: 'data-citations', data: Citation[] }.
      if (part.type === 'data-citations') {
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          setCitationsByMessageId((prev) => ({
            ...prev,
            [last.id]: part.data as Citation[],
          }));
        }
      }
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <aside className="hidden w-64 border-r border-slate-200 bg-white md:block">{sidebar}</aside>
      <div className="flex flex-1 flex-col">
        <MessageList messages={messages} citationsByMessageId={citationsByMessageId} />
        <Composer
          disabled={isStreaming}
          onSubmit={(q) => sendMessage({ text: q })}
          remaining={null}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `useChat` generic types don't accept the shape as-is, cast the transport parameter using `as never` at the call site rather than rewriting the types. Document the cast in the review.

- [ ] **Step 5: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-9-chat-shell.md`.

```bash
git add src/components/chat/Composer.tsx src/components/chat/MessageList.tsx src/components/chat/ChatShell.tsx docs/superpowers/reviews/2026-07-08-plan-3-task-9-chat-shell.md
git commit -m "feat(ui): ChatShell with Composer + MessageList wiring useChat"
```

---

## Task 10: ConversationSidebar

**Files:**
- Create: `src/components/chat/ConversationSidebar.tsx`

**Interfaces:**
- Consumes: `/api/conversations` (GET/POST), `/api/conversations/:id` (DELETE), `useRouter` from `next/navigation`.
- Produces: `<ConversationSidebar activeId conversations />` client component.

Note: the parent server page fetches initial conversations and passes them in. The sidebar refetches on mount only if the parent-provided list is `undefined`; primary source of truth stays server-side.

- [ ] **Step 1: Create `src/components/chat/ConversationSidebar.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface Props {
  activeId: string;
  initialConversations: Conversation[];
}

export function ConversationSidebar({ activeId, initialConversations }: Props) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [creating, setCreating] = useState(false);

  useEffect(() => setConversations(initialConversations), [initialConversations]);

  async function handleNew() {
    setCreating(true);
    try {
      const res = await fetch('/api/conversations', { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const { id } = (await res.json()) as { id: string };
      router.push(`/chat/${id}`);
    } catch {
      toast.error('Không tạo được cuộc trò chuyện');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Xóa thất bại');
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) router.push('/chat');
  }

  return (
    <div className="flex h-full flex-col p-3">
      <Button className="mb-3" onClick={handleNew} disabled={creating}>
        + Cuộc trò chuyện mới
      </Button>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center justify-between rounded px-2 py-2 text-sm ${
              c.id === activeId ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Link href={`/chat/${c.id}`} className="flex-1 truncate">
              {c.title}
            </Link>
            <button
              onClick={() => handleDelete(c.id)}
              className="ml-2 text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
              aria-label="Xóa"
            >
              ×
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-10-sidebar.md`.

```bash
git add src/components/chat/ConversationSidebar.tsx docs/superpowers/reviews/2026-07-08-plan-3-task-10-sidebar.md
git commit -m "feat(ui): ConversationSidebar with create + delete"
```

---

## Task 11: Chat pages (server components + hookup)

**Files:**
- Modify: `src/app/(app)/chat/page.tsx` (currently a stub — replace)
- Create: `src/app/(app)/chat/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `createServerClient`, `ConversationService`, and the client components from Tasks 8-10.
- Produces: two Next.js server pages. `/chat` redirects to latest or creates + redirects; `/chat/[id]` renders the shell with hydrated messages.

- [ ] **Step 1: Replace `src/app/(app)/chat/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/requireUser';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export default async function ChatIndexPage() {
  const user = await requireUser();
  const supabase = await createServerClient();
  const svc = new ConversationService(supabase);
  const list = await svc.list(user.id);

  if (list.length > 0) redirect(`/chat/${list[0].id}`);
  const created = await svc.create(user.id);
  redirect(`/chat/${created.id}`);
}
```

- [ ] **Step 2: Create `src/app/(app)/chat/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/requireUser';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';
import { ChatShell } from '@/components/chat/ChatShell';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createServerClient();
  const svc = new ConversationService(supabase);

  const owned = await svc.ownedBy(id, user.id);
  if (!owned) notFound();

  const [conversations, messages] = await Promise.all([
    svc.list(user.id),
    svc.getMessages(id, user.id),
  ]);

  const initialMessages: UIMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: 'text', text: m.content }],
  }));

  const initialCitationsByMessageId: Record<string, Citation[]> = {};
  for (const m of messages) {
    if (m.role === 'assistant' && m.citations.length > 0) {
      initialCitationsByMessageId[m.id] = m.citations;
    }
  }

  return (
    <ChatShell
      conversationId={id}
      initialMessages={initialMessages}
      initialCitationsByMessageId={initialCitationsByMessageId}
      sidebar={<ConversationSidebar activeId={id} initialConversations={conversations} />}
    />
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npx next build` (build catches many server/client boundary bugs and Next.js-specific issues).
Expected: typecheck clean; build succeeds. If build fails on unrelated existing pages, do NOT patch those; report and stop.

- [ ] **Step 4: Manual browser smoke (short version)**

Start `npm run dev`. Log in. Navigate to `/chat` — should redirect to `/chat/<id>`. Verify the shell renders with sidebar + composer. Do not exercise the RAG loop yet — Task 12 covers full smoke.

- [ ] **Step 5: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-11-chat-pages.md`.

```bash
git add "src/app/(app)/chat/page.tsx" "src/app/(app)/chat/[id]/page.tsx" docs/superpowers/reviews/2026-07-08-plan-3-task-11-chat-pages.md
git commit -m "feat(ui): /chat + /chat/[id] server pages wiring RAG shell"
```

---

## Task 12: RAG integration test (live Supabase + Gemini)

**Files:**
- Create: `test/integration/rag.integration.test.ts`
- Create: `test/fixtures/rag/seeded-law.txt`

**Interfaces:**
- Consumes: real Supabase Cloud + Gemini API via envs from `.env.local`; existing `GeminiEmbedder`; the `/api/chat` route handler imported directly.
- Produces: one gated integration test.

- [ ] **Step 1: Create the fixture**

Create `test/fixtures/rag/seeded-law.txt`:

```
Điều 5. Xử phạt người điều khiển xe ô tô vi phạm quy tắc giao thông đường bộ

Khoản 1. Phạt tiền từ 200.000 đồng đến 400.000 đồng đối với người điều khiển xe ô tô vượt đèn đỏ, đèn vàng.

Điều 6. Xử phạt người điều khiển xe máy vi phạm quy tắc giao thông đường bộ

Khoản 1. Phạt tiền từ 800.000 đồng đến 1.000.000 đồng đối với người điều khiển xe mô tô, xe gắn máy vượt đèn đỏ.
```

- [ ] **Step 2: Create the integration test**

Create `test/integration/rag.integration.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { GeminiEmbedder } from '@/lib/ingestion/embedder/GeminiEmbedder';
import type { Database } from '@/types/database';

const RUN = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!RUN)('RAG chat pipeline against live Supabase + Gemini', () => {
  let admin: ReturnType<typeof createClient<Database>>;
  let ownerId: string;
  let documentId: string;
  let conversationId: string;
  let cookieHeader: string;

  beforeAll(async () => {
    admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Look up or create test auth user (same convention as the ingestion integration test).
    const testEmail = 'rag-test@example.com';
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === testEmail);
    if (existing) {
      ownerId = existing.id;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: testEmail,
        email_confirm: true,
      });
      if (error || !created?.user) throw error ?? new Error('createUser returned no user');
      ownerId = created.user.id;
    }

    // Seed document + real 768-dim embeddings via GeminiEmbedder.
    const fixture = readFileSync(join(__dirname, '../fixtures/rag/seeded-law.txt'), 'utf-8');
    const paragraphs = fixture
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('Khoản'));

    const { data: doc, error: docErr } = await admin
      .from('documents')
      .insert({
        owner_id: ownerId,
        visibility: 'private',
        source_type: 'txt',
        title: 'Nghị định 100/2019 (fixture)',
        status: 'ready',
      })
      .select('id')
      .single();
    if (docErr || !doc) throw docErr ?? new Error('doc insert returned no row');
    documentId = doc.id;

    const embedder = new GeminiEmbedder({});
    const vectors = await embedder.embedBatch(paragraphs);
    const rows = paragraphs.map((content, i) => {
      const dieuMatch = /^(Khoản \d+)/.exec(content);
      return {
        document_id: documentId,
        ordinal: i,
        content,
        embedding: `[${vectors[i].join(',')}]`,
        dieu: i === 0 ? 'Điều 5' : 'Điều 6',
        khoan: dieuMatch?.[1] ?? null,
        diem: null,
        page: null,
      };
    });
    const { error: chunkErr } = await admin.from('chunks').insert(rows);
    if (chunkErr) throw chunkErr;

    // Create conversation.
    const { data: conv, error: convErr } = await admin
      .from('conversations')
      .insert({ owner_id: ownerId })
      .select('id')
      .single();
    if (convErr || !conv) throw convErr ?? new Error('conv insert returned no row');
    conversationId = conv.id;

    // Build a synthetic Supabase session cookie by generating an access token for the user.
    // For the integration test we bypass the login flow by monkey-patching createServerClient
    // to return an admin-style client that reports the test user. Simpler: skip cookie construction
    // and call the route handler with a request that carries no cookies, then override auth via mock.
    cookieHeader = ''; // placeholder — see monkey-patch below
  });

  afterAll(async () => {
    await admin.from('messages').delete().eq('conversation_id', conversationId);
    await admin.from('conversations').delete().eq('id', conversationId);
    await admin.from('chunks').delete().eq('document_id', documentId);
    await admin.from('documents').delete().eq('id', documentId);
    await admin.from('usage_daily').delete().eq('user_id', ownerId);
  });

  it('streams a grounded answer with data-citations for a seeded question', async () => {
    // Monkey-patch createServerClient so the route handler's auth check passes as the test user.
    const supaSsr = await import('@/lib/supabase/server');
    const original = supaSsr.createServerClient;
    (supaSsr as unknown as { createServerClient: unknown }).createServerClient = async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: ownerId, email: 'rag-test@example.com' } }, error: null }),
      },
    });

    try {
      const { POST } = await import('@/app/api/chat/route');
      const req = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Xe máy vượt đèn đỏ phạt bao nhiêu?' }],
          data: { conversationId },
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // Consume the SSE stream and gather text + data-citations.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let raw = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }
      expect(raw).toContain('data-citations');
      expect(raw.length).toBeGreaterThan(0);

      // Verify messages persisted (2 rows: user + assistant).
      const { data: msgs } = await admin
        .from('messages')
        .select('role, content, citations')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      expect(msgs).toHaveLength(2);
      expect(msgs![0].role).toBe('user');
      expect(msgs![1].role).toBe('assistant');
      // At least one citation on the assistant message.
      const cits = msgs![1].citations as unknown as Array<{ chunkId: string }>;
      expect(Array.isArray(cits)).toBe(true);
      expect(cits.length).toBeGreaterThanOrEqual(1);

      // Quota incremented.
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await admin
        .from('usage_daily')
        .select('question_count')
        .eq('user_id', ownerId)
        .eq('day', today)
        .single();
      expect(usage?.question_count).toBe(1);
    } finally {
      (supaSsr as unknown as { createServerClient: unknown }).createServerClient = original;
    }
  }, 90_000);
});
```

- [ ] **Step 3: Run the integration test**

```bash
set -a && source .env.local && set +a && RUN_INTEGRATION=1 npx vitest run test/integration/rag.integration.test.ts
```

Expected: 1 test passes within ~30-60s.

Common failures + fixes:
- **`serverEnv accessed in browser`** — missing `// @vitest-environment node` at the top of the file. It's already there; verify not stripped.
- **`400 invalid body`** — the route's Zod schema rejected something. Print `raw.slice(0, 500)` and check the SSE first chunks.
- **`403 conversation not owned`** — the monkey-patched `createServerClient` returned a different user id than the one who owns the conversation. Verify `ownerId` is the same in seed and mock.
- **Monkey-patch doesn't take effect** (strict ESM readonly exports) — swap to `vi.doMock('@/lib/supabase/server', () => ({ createServerClient: async () => ({...}) }))` **before** the dynamic `import('@/app/api/chat/route')` call. Wrap in `vi.resetModules()` to clear the module cache between tests. If you take this path, remove the `try/finally` restore block (doMock scope is per-test).

- [ ] **Step 4: Full suite + typecheck (integration off)**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: unit tests still 51 + Task 1-7 additions pass; integration test skipped (RUN_INTEGRATION not set); no type errors.

- [ ] **Step 5: Commit + review doc**

Write `docs/superpowers/reviews/2026-07-08-plan-3-task-12-integration-test.md`.

```bash
git add test/integration/rag.integration.test.ts test/fixtures/rag/seeded-law.txt docs/superpowers/reviews/2026-07-08-plan-3-task-12-integration-test.md
git commit -m "test(integration): end-to-end RAG chat pipeline against live services"
```

---

## Task 13: Manual browser smoke + plan close

**Files:**
- Create: `docs/superpowers/reviews/2026-07-08-plan-3-final-smoke.md`

- [ ] **Step 1: Full-stack smoke**

Start dev server: `npm run dev`.

Log in via Google OAuth. Ensure at least one document exists with `status='ready'` (upload one via `/documents` if needed — the fixture `test/fixtures/rag/seeded-law.txt` is a good candidate).

Navigate to `/chat`. Should redirect to `/chat/<latest-id>`.

Verify each of the 6 spec success criteria from §9.4:
1. Ask a question about the uploaded doc. Text streams token-by-token (not delivered all at once at the end).
2. Answer contains `[n]` markers highlighted in amber.
3. Pill row appears below the assistant bubble with 1+ pills labeled like `[1] Điều X, Khoản Y`.
4. Clicking a pill opens the modal showing the correct snippet + document title.
5. Composer sends the next question after streaming completes (no double-send lock stuck).
6. Reload the page. The conversation, messages, and citations all persist.

Additionally verify:
- Ask a nonsense question ("Kể chuyện cười đi") → short-circuit fallback message appears. No LLM call in server logs.
- New conversation via sidebar "+ Cuộc trò chuyện mới" works.
- Deleting a conversation removes it from sidebar and redirects if it was active.

- [ ] **Step 2: Regression check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all unit tests pass; typecheck clean.

- [ ] **Step 3: Write final smoke review**

Write `docs/superpowers/reviews/2026-07-08-plan-3-final-smoke.md` following the Plan 2 final-review template: what shipped, what was cut (YAGNI list), known issues / tech debt (quota race window from Task 1; regenerated DB types deferred; UI React tests deferred to Plan 4), and next steps (Plan 4 = deploy + Upstash Ratelimit + Supabase webhook registration).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/reviews/2026-07-08-plan-3-final-smoke.md
git commit -m "docs(review): Plan 3 final smoke + close"
```

Plan 3 is complete when this commit lands. Total commits: 13 feature commits + 1 close = 14.

---

## Appendix — Spec coverage checklist

- ✅ Retrieval via `match_chunks` RPC — Task 4.
- ✅ Strict-RAG system prompt with `[n]` markers — Task 2.
- ✅ Citation parsing + snippet truncation — Task 3.
- ✅ Conversation CRUD + history bounded — Tasks 5, 6, 11.
- ✅ Quota consumption — Task 1.
- ✅ Auto-create conversation on first send — Task 7.
- ✅ Short-circuit on empty retrieval — Task 7.
- ✅ Rollback on embed / retrieve failure — Task 7.
- ✅ Streaming via Vercel AI SDK v7 standalone helpers with `data-citations` custom part — Task 7 + 9.
- ✅ Chat UI (sidebar + main pane + citation modal) — Tasks 8, 9, 10, 11.
- ✅ Integration test end-to-end — Task 12.
- ✅ Manual browser smoke gate — Task 13.
- ✅ Observability log — Task 7.
- ⛔️ Deferred (spec §1.2): question rewriting, lazy title, Upstash Ratelimit, reranker, PDF viewer, React RTL tests, Playwright — none of these have tasks. All acceptable.
