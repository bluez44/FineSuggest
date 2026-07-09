// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
        embedding: `[${vectors[i]!.join(',')}]`,
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
  }, 120_000);

  afterAll(async () => {
    if (conversationId) {
      await admin.from('messages').delete().eq('conversation_id', conversationId);
      await admin.from('conversations').delete().eq('id', conversationId);
    }
    if (documentId) {
      await admin.from('chunks').delete().eq('document_id', documentId);
      await admin.from('documents').delete().eq('id', documentId);
    }
    if (ownerId) {
      await admin.from('usage_daily').delete().eq('user_id', ownerId);
    }
  });

  it('streams a grounded answer with data-citations for a seeded question', async () => {
    // Monkey-patch failed (ESM readonly exports). Use vi.doMock before dynamic import.
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: ownerId, email: 'rag-test@example.com' } },
            error: null,
          }),
        },
      }),
    }));

    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // Vercel AI SDK v7 UIMessage shape (parts array, not flat content).
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Xe máy vượt đèn đỏ phạt bao nhiêu?' }] },
        ],
        data: { conversationId },
      }),
    });
    const res = await POST(req);

    // Debug: if not 200, print body
    if (res.status !== 200) {
      const text = await res.text();
      console.error('Route returned', res.status, text.slice(0, 500));
    }
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
    console.log('SSE raw (first 500):', raw.slice(0, 500));
    expect(raw).toContain('data-citations');
    expect(raw.length).toBeGreaterThan(0);

    // Verify messages persisted (2 rows: user + assistant).
    const { data: msgs } = await admin
      .from('messages')
      .select('role, content, citations')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    expect(msgs).toHaveLength(2);
    expect(msgs![0]!.role).toBe('user');
    expect(msgs![1]!.role).toBe('assistant');
    // At least one citation on the assistant message.
    const cits = msgs![1]!.citations as unknown as Array<{ chunkId: string }>;
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
  }, 90_000);
});
