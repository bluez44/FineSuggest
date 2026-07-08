// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { IngestionPipeline } from '@/lib/ingestion/IngestionPipeline';
import type { Database } from '@/types/database';

const RUN = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!RUN)('ingestion pipeline against live Supabase', () => {
  let admin: ReturnType<typeof createClient<Database>>;
  let ownerId: string;
  let documentId: string;

  beforeAll(async () => {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    admin = createClient<Database>(URL, KEY);

    // Look up or create a real auth user — auth.admin.createUser assigns its own UUID,
    // so we can't hardcode one. The profile row is created by the on-auth-user trigger.
    const testEmail = 'ingest-test@example.com';
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

    const { data, error: insertErr } = await admin
      .from('documents')
      .insert({
        owner_id: ownerId,
        visibility: 'private',
        source_type: 'txt',
        title: 'ingest-integration-test.txt',
        status: 'pending',
      })
      .select('id')
      .single();
    if (insertErr || !data) throw insertErr ?? new Error('document insert returned no row');
    documentId = data.id;
  });

  afterAll(async () => {
    await admin.from('chunks').delete().eq('document_id', documentId);
    await admin.from('documents').delete().eq('id', documentId);
  });

  it('runs load → split → embed → store, producing 768-dim chunks', async () => {
    const fixture = readFileSync(join(__dirname, '../fixtures/sample-law.txt'));
    const pipeline = IngestionPipeline.build({ client: admin });

    const result = await pipeline.run(documentId, {
      kind: 'buffer',
      buffer: fixture,
      filename: 'sample-law.txt',
      mimeType: 'text/plain',
    });

    expect(result.chunkCount).toBeGreaterThan(0);

    const { data: chunks } = await admin
      .from('chunks')
      .select('id, ordinal, dieu, content, embedding')
      .eq('document_id', documentId)
      .order('ordinal');
    expect(chunks!.length).toBe(result.chunkCount);
    // At least one chunk carries a Điều label from the fixture.
    expect(chunks!.some((c) => c.dieu?.startsWith('Điều '))).toBe(true);

    // embedding is a string like "[0.1,0.2,...]" (pgvector serialization)
    const first = chunks![0]!;
    expect(typeof first.embedding).toBe('string');
    const dims = (first.embedding as string).slice(1, -1).split(',').length;
    expect(dims).toBe(768);

    const { data: doc } = await admin.from('documents').select('status').eq('id', documentId).single();
    expect(doc?.status).toBe('ready');
  }, 60_000); // 60s budget: real Gemini API calls
});
