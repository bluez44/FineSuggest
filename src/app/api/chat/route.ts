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
    .object({ conversationId: z.string().nullable().optional() })
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
    embedding = vectors[0] as number[];
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
        writer.write({ type: 'text-start', id: 'fallback' } as unknown as never);
        writer.write({ type: 'text-delta', id: 'fallback', delta: FALLBACK_ANSWER } as unknown as never);
        writer.write({ type: 'text-end', id: 'fallback' } as unknown as never);
        writer.write({ type: 'data-citations', data: [] as unknown as never } as unknown as never);
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
        }) as unknown as never,
      );
      const [text, usage] = await Promise.all([result.text, result.usage]);
      const citations: Citation[] = parseCitations(text, retrieved);
      writer.write({ type: 'data-citations', data: citations as unknown as never } as unknown as never);
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
