# Trợ lý hỏi đáp Luật giao thông (RAG) — Thiết kế

**Ngày:** 2026-06-30
**Trạng thái:** Draft — đã thông qua các phần kiến trúc với người dùng.
**Tên dự án (tạm):** FineSuggest

---

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu

Xây dựng một ứng dụng web **responsive** cho phép người dùng đăng nhập (Google), đặt câu hỏi về **luật giao thông Việt Nam** và nhận câu trả lời từ AI **chỉ dựa trên nội dung tài liệu** đã được nạp vào hệ thống. Mỗi câu trả lời có **trích dẫn rõ ràng** tới điều/khoản/điểm trong văn bản nguồn.

### 1.2 Phạm vi v1

- Bộ tài liệu mặc định (do admin nạp, visibility = `public`) sẵn cho mọi người dùng.
- Người dùng có thể upload tài liệu của riêng họ (visibility = `private`) để hỏi.
- Hội thoại đa lượt (multi-turn) với ngữ cảnh có giới hạn; mỗi user nhiều conversation.
- Trang admin (CRUD bộ tài liệu mặc định) bảo vệ bằng email allowlist.
- Quota theo ngày + giới hạn upload + rate limit theo IP/user.

### 1.3 Ngoài phạm vi v1 (YAGNI)

- Đa ngôn ngữ (chỉ tiếng Việt v1).
- Reranker, multi-query expansion.
- Hybrid search (BM25 + vector) — có thể nâng cấp ở v2.
- Background queue chuyên dụng (dùng Vercel Cron poll cho v1).
- Mobile app, plugin browser.

---

## 2. Kiến trúc tổng quan

Một **codebase Next.js full-stack** trên Vercel, Supabase là backend duy nhất, Gemini cung cấp embedding + chat LLM.

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (responsive UI — Next.js App Router + Tailwind)       │
│  • /chat (multi-turn chat)                                     │
│  • /documents (user upload + danh sách)                        │
│  • /admin (CRUD bộ tài liệu mặc định, allowlist email)         │
└──────────────────────────────┬─────────────────────────────────┘
                               │  HTTPS / SSE streaming
┌──────────────────────────────▼─────────────────────────────────┐
│  Next.js Route Handlers (Node runtime)                         │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ /api/auth/*  │  │ /api/ingest     │  │ /api/chat        │   │
│  │ (Supabase    │  │ (loader →       │  │ (RAG pipeline:   │   │
│  │  Auth helper)│  │  splitter →     │  │  embed → vector  │   │
│  │              │  │  embed → store) │  │  search → LLM)   │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│  Supabase                            │  Gemini API             │
│  • Auth (Google OAuth)               │  • text-embedding-004   │
│  • Postgres + pgvector (embeddings)  │  • gemini-2.5-flash     │
│  • Storage (file gốc PDF/DOCX/...)   │                         │
│  • Row-Level Security (RLS) per user │                         │
└────────────────────────────────────────────────────────────────┘
```

### Nguyên tắc

- **Source of truth duy nhất**: Supabase giữ user, file gốc, embeddings, chat history.
- **RLS làm lớp bảo mật cuối**: mỗi user chỉ truy cập được dữ liệu của họ + tài liệu admin public.
- **Strict RAG**: không có context phù hợp → trả lời "không tìm thấy trong tài liệu", không hallucination.
- **Streaming**: câu trả lời stream từng token về client (Vercel AI SDK + Gemini stream).
- **Đóng/mở qua interface**: thêm loại tài liệu mới hoặc splitter mới không sửa code consumer.

---

## 3. Phân rã component & Design patterns

### 3.1 Lớp Ingestion — Strategy + Factory

```
src/lib/ingestion/
├── loaders/
│   ├── DocumentLoader.ts          # interface { load(input): Promise<RawDoc[]> }
│   ├── PdfLoader.ts               # implements DocumentLoader (pdfjs-dist)
│   ├── DocxLoader.ts              # implements DocumentLoader (mammoth)
│   ├── TextLoader.ts              # implements DocumentLoader (.txt/.md)
│   ├── UrlLoader.ts               # cheerio + @mozilla/readability
│   └── LoaderFactory.ts           # chọn loader theo mime/extension/URL
│
├── splitters/
│   ├── ChunkSplitter.ts           # interface { split(doc): Chunk[] }
│   ├── VietnameseLawSplitter.ts   # parse "Điều X", "Khoản Y", "Điểm Z"
│   ├── RecursiveSplitter.ts       # fallback chung (LangChain RecursiveCharacterTextSplitter)
│   └── SplitterFactory.ts         # auto-detect: nếu có "Điều ..." → law splitter
│
├── embedder/
│   └── GeminiEmbedder.ts          # gọi text-embedding-004, batch + retry
│
├── store/
│   └── PgVectorStore.ts           # upsert chunks vào Supabase (pgvector)
│
└── IngestionPipeline.ts           # orchestrator: load → split → embed → store
```

### 3.2 Lớp RAG (truy vấn) — Pipeline + Strategy

```
src/lib/rag/
├── retriever/
│   ├── Retriever.ts               # interface { retrieve(query, opts): Chunk[] }
│   └── PgVectorRetriever.ts       # gọi RPC match_chunks trong Supabase
├── prompt/
│   ├── PromptBuilder.ts           # ghép system + context + history + question
│   └── strictRagSystemPrompt.ts   # ràng buộc "chỉ trả lời từ context"
├── llm/
│   └── GeminiChatModel.ts         # streaming wrapper quanh Gemini
├── memory/
│   └── BoundedChatHistory.ts      # giữ N turn cuối / cắt token
├── citation/
│   └── CitationFormatter.ts       # ánh xạ chunk → {dieu, khoan, document, page}
└── RagPipeline.ts                 # orchestrator: query → retrieve → prompt → stream → cite
```

### 3.3 Lớp Domain (services dùng từ API routes)

```
src/lib/services/
├── DocumentService.ts             # upload, list, delete (trigger ingest)
├── ConversationService.ts         # create, list, append message
├── QuotaService.ts                # check/decrement daily quota
└── AdminService.ts                # CRUD default docs (allowlist enforced)
```

### 3.4 Design patterns áp dụng

| Pattern | Vị trí | Lý do |
|---|---|---|
| **Strategy** | `DocumentLoader`, `ChunkSplitter`, `Retriever` | Đóng/mở: thêm format mới (RTF, HTML…) không sửa code cũ |
| **Factory** | `LoaderFactory`, `SplitterFactory` | Tách logic chọn implementation khỏi consumer |
| **Pipeline** | `IngestionPipeline`, `RagPipeline` | Bước rõ ràng, dễ test từng bước, dễ thêm bước (reranker) sau này |
| **Repository** | `*Service` ở trên Supabase | Tách logic nghiệp vụ khỏi truy vấn DB |
| **Dependency Injection (constructor)** | Tất cả class trên | Test thay mock dễ dàng, không có singleton ẩn |

### 3.5 Quy tắc unit boundary

Mỗi unit phải trả lời 3 câu hỏi:
- **Làm gì**: 1 dòng JSDoc trên class.
- **Dùng thế nào**: 1 public method chính (`load`, `split`, `retrieve`, `run`).
- **Phụ thuộc gì**: chỉ qua constructor — không import singleton, không gọi `fetch` toàn cục bên trong.

---

## 4. Database schema (Supabase Postgres + pgvector)

Tất cả bảng bật **Row-Level Security**. User chỉ thấy hàng `owner_id = auth.uid()` hoặc `visibility = 'public'`.

```sql
create extension if not exists vector;

-- 1. Profile user (mở rộng auth.users)
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  role            text not null default 'user',     -- 'user' | 'admin'
  created_at      timestamptz default now()
);

-- 2. Tài liệu (admin + user)
create table documents (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references profiles(id) on delete cascade, -- null cho tài liệu admin
  visibility      text not null check (visibility in ('public','private')),
  source_type     text not null check (source_type in ('pdf','docx','txt','md','url')),
  title           text not null,
  storage_path    text,                              -- path trong Supabase Storage
  source_url      text,                              -- chỉ với source_type='url'
  status          text not null default 'pending',   -- pending|processing|ready|failed
  error_message   text,
  metadata        jsonb default '{}',                -- số trang, ngày ban hành, ký hiệu
  created_at      timestamptz default now()
);
create index on documents(owner_id);
create index on documents(visibility);

-- 3. Chunks (text + embedding)
create table chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  ordinal         int not null,
  content         text not null,
  embedding       vector(768) not null,              -- Gemini text-embedding-004 = 768d
  dieu            text,                              -- "Điều 5"
  khoan           text,                              -- "Khoản 2"
  diem            text,                              -- "Điểm a"
  page            int,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);
create index on chunks(document_id);
create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 4. Conversation
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  title           text not null default 'Cuộc trò chuyện mới',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on conversations(owner_id, updated_at desc);

-- 5. Messages
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  citations       jsonb default '[]',                -- [{chunk_id, document_id, dieu, khoan, snippet}]
  created_at      timestamptz default now()
);
create index on messages(conversation_id, created_at);

-- 6. Quota counter
create table usage_daily (
  user_id         uuid not null references profiles(id) on delete cascade,
  day             date not null,
  question_count  int not null default 0,
  primary key (user_id, day)
);
```

### RLS policies (rút gọn)

```sql
create policy "own docs" on documents
  for all using (owner_id = auth.uid());
create policy "read public docs" on documents
  for select using (visibility = 'public');

create policy "read chunks of accessible docs" on chunks for select
  using (exists (
    select 1 from documents d
    where d.id = chunks.document_id
      and (d.owner_id = auth.uid() or d.visibility = 'public')
  ));

create policy "own conversations" on conversations
  for all using (owner_id = auth.uid());
create policy "own messages" on messages for all
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id and c.owner_id = auth.uid()
  ));
```

Admin bypass RLS bằng `SUPABASE_SERVICE_ROLE_KEY` — chỉ sử dụng trong route `/api/admin/*` sau khi đã verify `profile.role = 'admin'`.

### Vector search RPC

```sql
create or replace function match_chunks(
  query_embedding vector(768),
  match_count int default 6,
  user_id uuid default null
) returns table (
  id uuid, document_id uuid, content text, dieu text, khoan text,
  diem text, page int, similarity float
) language sql stable as $$
  select c.id, c.document_id, c.content, c.dieu, c.khoan, c.diem, c.page,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where d.visibility = 'public' or d.owner_id = user_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## 5. RAG pipeline chi tiết (`POST /api/chat`)

**Input từ client:**
```json
{ "conversationId": "uuid", "message": "Vượt đèn đỏ phạt bao nhiêu?" }
```

**Bước 1 — Auth + Quota guard**
- Lấy user từ Supabase server client. Chưa login → 401.
- `QuotaService.consumeQuestion(userId)`: check `usage_daily.question_count < DAILY_LIMIT` + increment trong transaction. Vượt → 429.
- Middleware rate limit theo IP+user (Upstash Ratelimit).

**Bước 2 — Tải history bounded**
- `ConversationService.getRecentMessages(conversationId, limit=6)` — 3 cặp Q&A gần nhất.
- `BoundedChatHistory`: nếu tổng token > `MAX_HISTORY_TOKENS` (1500), cắt từ cũ nhất.

**Bước 3 — Question rewriting (chỉ khi có history)**
- Gọi Gemini rewrite câu follow-up ("thế còn xe máy?") thành standalone query ("Mức phạt vượt đèn đỏ với xe máy là bao nhiêu?").
- Bỏ qua nếu là message đầu tiên.

**Bước 4 — Embed query**
- `GeminiEmbedder.embed(query)` → `vector(768)`.

**Bước 5 — Retrieve**
- Gọi RPC `match_chunks(embedding, match_count=6, user_id)`.
- Lọc thêm: bỏ chunk có `similarity < 0.5` (threshold cấu hình `MIN_SIMILARITY`).
- Nếu kết quả rỗng → **short-circuit**: trả "Tôi không tìm thấy nội dung này trong tài liệu hiện có…". Không gọi LLM, **hoàn lại quota**.

**Bước 6 — Prompt build**

System prompt (cố định):
```
Bạn là trợ lý pháp luật giao thông. CHỈ trả lời dựa trên các đoạn
trích trong phần CONTEXT bên dưới. Tuyệt đối không suy đoán, không
bổ sung kiến thức ngoài.

Nếu CONTEXT không chứa đủ thông tin để trả lời, hãy nói:
"Tôi không tìm thấy nội dung này trong tài liệu hiện có."

Khi trích dẫn, dùng marker [n] tương ứng với số thứ tự đoạn trong CONTEXT.
Trả lời ngắn gọn, rõ ràng, đúng pháp lý.

CONTEXT:
[1] (Điều 5, Khoản 2, Nghị định 100/2019) <nội dung chunk>
[2] (Điều 6, Khoản 1, Nghị định 100/2019) <nội dung chunk>
...
```

User prompt = lịch sử N turn + câu hỏi mới.

**Bước 7 — LLM streaming**
- `GeminiChatModel.stream(messages)` → `ReadableStream`.
- Trả về SSE qua Next.js Route Handler (`Content-Type: text/event-stream`).
- Client dùng Vercel AI SDK `useChat` hook.

**Bước 8 — Persist + citations (sau khi stream xong)**
- Append message user + assistant vào DB.
- `CitationFormatter` parse các marker `[n]` trong câu trả lời → ánh xạ về `{chunk_id, document_id, dieu, khoan, snippet (≤300 chars)}`.
- Lưu vào `messages.citations`.

**Bước 9 — Conversation title (lazy)**
- Lần message đầu của conversation: background gọi Gemini sinh title ngắn → update `conversations.title`. Không block response.

### Error handling

| Trường hợp | Xử lý |
|---|---|
| Gemini timeout / 5xx | Retry 1 lần backoff; thất bại → message lỗi, **hoàn quota** |
| Embedding fail | 500, **không** lưu message user (tránh state lệch) |
| Client disconnect khi stream | Hủy stream; vẫn lưu nếu đã có nội dung |
| Context overflow | Cắt history thêm + log warning |

### Observability

- Log structured mỗi request: `requestId, userId, conversationId, retrievedCount, llmLatencyMs, totalTokens`.
- Lưu `messages.metadata.retrieval = {count, top_similarity}` để debug.

---

## 6. API endpoints & UI surfaces

### 6.1 API endpoints

| Method | Path | Mục đích | Auth |
|---|---|---|---|
| GET | `/api/auth/callback` | Supabase OAuth callback | — |
| POST | `/api/auth/signout` | Đăng xuất | user |
| GET | `/api/documents` | List tài liệu của user + public | user |
| POST | `/api/documents/upload` | Upload file/URL → tạo `documents` row, trả `id` | user |
| DELETE | `/api/documents/:id` | Xóa kèm chunks + storage file | owner |
| POST | `/api/documents/:id/reindex` | Re-run ingestion | owner / admin |
| POST | `/api/ingest/process` | Internal worker endpoint | service-key |
| GET | `/api/conversations` | List conversations | user |
| POST | `/api/conversations` | Tạo conversation | user |
| PATCH | `/api/conversations/:id` | Rename | owner |
| DELETE | `/api/conversations/:id` | Xóa | owner |
| GET | `/api/conversations/:id/messages` | Messages + citations | owner |
| POST | `/api/chat` | RAG streaming (Phần 5) | user + quota |
| GET | `/api/admin/documents` | List ALL public docs | admin |
| POST | `/api/admin/documents` | Upload tài liệu public | admin |
| DELETE | `/api/admin/documents/:id` | Xóa khỏi KB mặc định | admin |
| GET | `/api/admin/stats` | Tổng số user, docs, queries hôm nay | admin |

### 6.2 Ingestion async

PDF lớn cần 30s+ → không xử lý đồng bộ trong upload handler (Vercel route handler timeout 60s trên Hobby plan, 300s Pro).

1. `POST /api/documents/upload` → lưu file vào Supabase Storage, tạo row `status='pending'`, trả `id` ngay.
2. Worker `POST /api/ingest/process` (service key): set `status='processing'` cho 1 doc → chạy pipeline → `status='ready'` hoặc `'failed'` + `error_message`.
3. **Trigger worker** — chọn 1 trong 2 cách (cấu hình qua env, không lock-in):
   - **(Recommended cho v1)** Supabase Database Webhook: khi `documents` có row mới (`status='pending'`) → Supabase gửi HTTP POST tới `/api/ingest/process?documentId=...`. Gần như real-time, không cần cron.
   - **Fallback** Vercel Cron polling: Hobby plan minimum 1 cron/day; Pro plan 1 phút. Cron job gọi `/api/ingest/process` để quét batch các doc `pending` cũ nhất.
4. Client subscribe **Supabase Realtime** channel trên bảng `documents` (filter `owner_id`) để nhận push khi `status` đổi. Fallback poll `GET /api/documents` mỗi 5s khi có doc đang process.

### 6.3 UI surfaces (responsive, mobile-first, Tailwind + shadcn/ui)

```
/login              — nút "Đăng nhập với Google"
/                   — landing: giới thiệu + CTA → /chat
/chat               — main app
  • Sidebar (collapse mobile): danh sách conversations + nút "Mới"
  • Main pane: stream messages + citation pills
  • Composer: textarea + send + counter "X câu/ngày còn lại"
/chat/[id]          — mở conversation cụ thể
/documents          — danh sách tài liệu của user
  • Card: title, source_type icon, status badge, Delete + Reindex
  • Nút "+ Thêm tài liệu" → modal: upload file HOẶC paste URL
/admin              — chỉ admin (role='admin')
  • Tab "Tài liệu mặc định": CRUD public docs
  • Tab "Thống kê": users, queries hôm nay
```

### 6.4 Component tree

```
app/
├── (auth)/login/page.tsx
├── (app)/
│   ├── layout.tsx                 # sidebar + header (server component)
│   ├── chat/
│   │   ├── page.tsx               # redirect → conversation mới nhất hoặc tạo
│   │   └── [id]/page.tsx
│   ├── documents/page.tsx
│   └── admin/
│       ├── layout.tsx             # guard role='admin'
│       └── page.tsx
└── api/...

components/
├── chat/
│   ├── MessageList.tsx
│   ├── MessageBubble.tsx          # render content + citations footer
│   ├── CitationPill.tsx           # click → CitationPreviewModal
│   ├── CitationPreviewModal.tsx
│   └── Composer.tsx
├── documents/
│   ├── DocumentCard.tsx
│   └── UploadDialog.tsx           # 2 tab: File / URL
├── admin/
│   └── PublicDocsTable.tsx
└── shared/
    ├── Sidebar.tsx
    └── ConversationItem.tsx
```

### 6.5 Responsive breakpoints

- `< 768px`: sidebar ẩn, hiện qua hamburger; composer fixed-bottom; citation modal full-screen.
- `≥ 768px`: sidebar permanent 280px, citation modal centered ~600px.

---

## 7. Auth, Quota, Rate limiting, Security

### 7.1 Authentication

- Supabase Auth + Google OAuth (config trong Supabase Dashboard).
- Client: `@supabase/ssr` với `createServerClient()` cho route handlers, `createBrowserClient()` cho client components.
- Postgres trigger `on_auth_user_created` tạo `profiles` row khi user signup. Default `role='user'`.
- Promote admin: update tay HOẶC dùng env `ADMIN_EMAILS` để bootstrap khi user login lần đầu.
- Session lưu trong HTTP-only cookie.

### 7.2 Authorization layers (defense in depth)

| Lớp | Cơ chế |
|---|---|
| Route guard | `/admin/*` page check `profile.role === 'admin'`, redirect nếu không |
| API guard | Mỗi handler gọi `requireUser()` hoặc `requireAdmin()` — fail fast 401/403 |
| RLS (DB) | Supabase RLS policies — lớp cuối, không bypass từ client |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` chỉ trong route admin/internal, không expose client |

### 7.3 Quota (tầng nghiệp vụ)

```
DAILY_QUESTION_LIMIT       = 50
MAX_FILE_SIZE_MB           = 20
MAX_FILES_PER_USER         = 10
MAX_DOC_PAGES              = 200
```

`QuotaService.consumeQuestion(userId)` (atomic):
```sql
insert into usage_daily (user_id, day, question_count)
values ($1, current_date, 1)
on conflict (user_id, day) do update
  set question_count = usage_daily.question_count + 1
returning question_count;
```
Nếu trả về > `DAILY_QUESTION_LIMIT` → throw `QuotaExceeded`; route handler decrement lại để rollback.

`QuotaService.canUpload(userId, fileSizeBytes)`:
- Đếm `documents where owner_id=$1` so với `MAX_FILES_PER_USER`.
- So `fileSizeBytes` với `MAX_FILE_SIZE_MB`.

### 7.4 Rate limiting (chống burst)

- **Upstash Ratelimit** (free tier Redis): sliding window 10 req/phút theo `userId`, 20 req/phút theo IP.
- Chạy ở `middleware.ts` (edge runtime) cho `/api/chat`, `/api/documents/upload`.
- Trả 429 với header `Retry-After`.

### 7.5 File upload security

- Validate MIME type server-side bằng `file-type` (sniff, không tin `file.type` từ client).
- Whitelist: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `text/markdown`.
- Check `Content-Length` trước khi đọc stream.
- Lưu Supabase Storage bucket `documents/` với path `{userId}/{documentId}.{ext}`. RLS storage cho phép owner đọc.
- **Không** serve file gốc qua URL public; dùng signed URL hết hạn 5 phút khi user click "Xem nguồn".

### 7.6 Prompt injection mitigation

- System prompt đặt trước CONTEXT với delimiter rõ ràng (`<<<CONTEXT>>>` / `<<<END>>>`).
- Strip control chars + escape `{{ }}` trong content chunks trước khi inject.
- Câu hỏi user không được override system prompt; log warning với heuristics (không block).
- Strict RAG mode tự thân đã giảm rủi ro.

### 7.7 Env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only
GOOGLE_GENERATIVE_AI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ADMIN_EMAILS=                       # comma-separated
APP_URL=
```
Server keys không bao giờ prefix `NEXT_PUBLIC_`. Có `.env.example` commit vào repo.

### 7.8 HTTPS / Headers

- Vercel mặc định HTTPS.
- `next.config.js` thêm: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP cơ bản.

---

## 8. Testing strategy

### 8.1 Pyramid

```
       ╱╲          E2E (5-10 tests)        — Playwright
      ╱──╲         Integration (~30)       — Vitest + Supabase local
     ╱────╲        Unit (~100+)            — Vitest
    ╱──────╲
```

### 8.2 Unit (`src/lib/**/*.test.ts`)

| Class | Test gì |
|---|---|
| `PdfLoader`, `DocxLoader`, `TextLoader`, `UrlLoader` | Fixture thật → output `RawDoc[]` đúng |
| `LoaderFactory` | Map đúng MIME/extension/URL; throw khi không hỗ trợ |
| `VietnameseLawSplitter` | Văn bản "Điều 5. Khoản 2. Điểm a..." → chunks có metadata đúng |
| `SplitterFactory` | Auto-detect: có "Điều X" → law splitter; không → recursive |
| `BoundedChatHistory` | Cắt đúng khi vượt token; giữ thứ tự cặp user/assistant |
| `PromptBuilder` | Snapshot test format prompt + escape an toàn |
| `CitationFormatter` | Parse `[1][2]` → map về chunk metadata đúng |
| `QuotaService` | Lần đầu trong ngày, vượt quota, 2 request đồng thời |

**Quy tắc:**
- Không mock những gì rẻ để chạy thật (parsers, formatters).
- Chỉ mock biên ngoài: Gemini API (qua interface `LLM`/`Embedder`), Supabase client (interface repository).
- Mỗi test < 100ms; total suite < 30s.

### 8.3 Integration (`test/integration/`)

Chạy trên Supabase test project (hoặc `supabase start` local):

| Test | Phạm vi |
|---|---|
| `ingestion.integration.test.ts` | Upload PDF mẫu → pipeline → `chunks` table có row đúng + embedding shape 768d |
| `retrieval.integration.test.ts` | Seed chunks → query → `match_chunks` RPC trả top-K đúng |
| `rls.integration.test.ts` | User A không đọc được data của user B (gọi với JWT A) — **bắt buộc** |
| `quota.integration.test.ts` | 5 request đồng thời → counter đúng, không vượt limit |
| `api.chat.integration.test.ts` | E2E route handler với Gemini thật (tag `@live`, gated env) |

### 8.4 E2E (Playwright, `e2e/`)

10 happy paths:

1. Đăng nhập Google (dùng test user / magic link cho test env)
2. Upload PDF → đợi `status='ready'` → thấy trong list
3. Tạo conversation, hỏi câu có trong tài liệu → stream + citation pill
4. Click citation pill → preview modal hiện snippet đúng
5. Hỏi câu **ngoài** tài liệu → nhận "không tìm thấy"
6. Follow-up question dùng context conversation
7. Vượt quota → 429 với message tiếng Việt
8. Admin upload tài liệu public → user khác hỏi được
9. User A không thấy tài liệu user B
10. Responsive mobile (375×667) cho luồng 3

### 8.5 CI (GitHub Actions)

```yaml
on: [push, pull_request]
jobs:
  - lint        # eslint + prettier --check
  - typecheck   # tsc --noEmit
  - unit        # vitest run
  - integration # supabase start → vitest run integration
  - e2e         # playwright (chỉ PR vào main)
```

---

## 9. Tech stack tổng kết

| Layer | Choice | Lý do |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript strict** | Full-stack 1 codebase, Vercel-native |
| UI | **Tailwind CSS + shadcn/ui** | Primitives + dark mode + responsive utilities |
| AI orchestration | **LangChain.js** (`@langchain/google-genai`, `@langchain/textsplitters`) | Theo yêu cầu; loader/splitter sẵn |
| Streaming UI | **Vercel AI SDK** (`ai`, `@ai-sdk/google`) | `useChat` hook + SSE chuẩn |
| LLM | **Gemini 2.5 Flash** (chat) + **text-embedding-004** (768d) | Giá rẻ, hỗ trợ tiếng Việt tốt |
| DB | **Supabase Postgres + pgvector** | Vector + relational + Auth + Storage 1 nơi |
| File parsing | `pdfjs-dist` / `mammoth` / `cheerio` + `@mozilla/readability` | Mỗi loader 1 lib chuyên |
| Auth | **Supabase Auth** (Google OAuth) | Tích hợp native với RLS |
| Rate limit | **@upstash/ratelimit** + Upstash Redis | Free tier, edge-compatible |
| Testing | **Vitest** + **Playwright** + **Supabase local** | Mainstream Next.js |
| Deploy | **Vercel** + **Supabase Cloud** | Free tier đủ demo |
| Background jobs | **Supabase DB Webhook** (primary) + Vercel Cron (fallback) | Webhook gần real-time, free; Cron cần Pro để polling 1 phút |
| Lint/format | **ESLint + Prettier** | Standard |

---

## 10. Definition of Done (v1)

- [ ] Tất cả test pass (unit + integration).
- [ ] 10 E2E flows xanh.
- [ ] Manual smoke: hỏi 5 câu trong tài liệu mẫu — citation chính xác, không hallucination.
- [ ] Manual cross-user: tài liệu user A không lộ sang user B.
- [ ] Lighthouse mobile ≥ 90 (Performance, Accessibility).
- [ ] README có hướng dẫn setup + `.env.example`.

---

## 11. Quyết định đã chốt với user (audit trail)

| Quyết định | Lựa chọn |
|---|---|
| Nguồn tài liệu | Cả admin-loaded và user-uploaded |
| Quy mô | Public + Google OAuth bắt buộc |
| Stack | Next.js full-stack + LangChain.js |
| Định dạng | PDF, DOCX, TXT, MD, URL (Strategy/Factory pattern) |
| Hạ tầng | Supabase (Postgres + pgvector + Auth + Storage) |
| Hành vi RAG | Strict — refuse khi không có context |
| Citation | Có — điều/khoản + preview |
| Chat history | Persistent, multiple conversations/user, bounded context |
| Phạm vi retrieval | Search toàn bộ (user docs + public), AI tự chọn nguồn |
| Admin UI | CRUD trong app (allowlist email) |
| Quota | Daily question limit + file size/count + IP rate limit |
| Chunking | Structure-aware (với fallback recursive cho format không có Điều/Khoản) |
| RAG pipeline | Basic: vector search → LLM (v1) |
