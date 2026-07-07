import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { IngestionPipeline } from '@/lib/ingestion/IngestionPipeline';
import type { LoaderInput } from '@/lib/ingestion/types';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for Pro plan; Hobby caps at 60s

const bodySchema = z.object({
  type: z.literal('INSERT').optional(),
  table: z.literal('documents').optional(),
  record: z.object({
    id: z.string().uuid(),
    owner_id: z.string().uuid().nullable(),
    source_type: z.enum(['pdf', 'docx', 'txt', 'md', 'url']),
    storage_path: z.string().nullable(),
    source_url: z.string().url().nullable().refine(
    (u) => u === null || u.startsWith('http://') || u.startsWith('https://'),
    { message: 'source_url must use http(s) scheme' },
  ),
    status: z.string(),
  }),
});

const BUCKET = 'documents';

export async function POST(req: Request) {
  // 1. Verify shared secret (timing-safe comparison)
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${serverEnv.INGEST_WEBHOOK_SECRET}`;
  const authHash = createHash('sha256').update(auth).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  if (!timingSafeEqual(authHash, expectedHash)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Parse payload (Supabase DB Webhook format)
  const raw = await req.json();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad payload', issues: parsed.error.issues }, { status: 400 });
  }
  const { record } = parsed.data;

  if (record.status !== 'pending') {
    return NextResponse.json({ skipped: true, reason: `status=${record.status}` });
  }

  // 3. Build service-role client + pipeline
  const admin = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  );
  const pipeline = IngestionPipeline.build({ client: admin });

  // 4. Prepare LoaderInput
  let input: LoaderInput;
  if (record.source_type === 'url') {
    if (!record.source_url) {
      return failStatus(admin, record.id, 'URL source with no source_url');
    }
    input = { kind: 'url', url: record.source_url };
  } else {
    if (!record.storage_path) {
      return failStatus(admin, record.id, `${record.source_type} source with no storage_path`);
    }
    const { data, error } = await admin.storage.from(BUCKET).download(record.storage_path);
    if (error || !data) {
      return failStatus(admin, record.id, `Storage download failed: ${error?.message}`);
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    input = {
      kind: 'buffer',
      buffer,
      filename: record.storage_path.split('/').pop() ?? 'file',
      mimeType: guessMime(record.source_type),
    };
  }

  // 5. Run pipeline (throws on failure, but marks status='failed' internally)
  try {
    const result = await pipeline.run(record.id, input);
    return NextResponse.json({ ok: true, chunkCount: result.chunkCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function failStatus(
  admin: ReturnType<typeof createClient<Database>>,
  id: string,
  message: string,
) {
  const { error } = await admin.from('documents').update({ status: 'failed', error_message: message }).eq('id', id);
  if (error) console.error('failStatus update failed', { id, error });
  return NextResponse.json({ error: message }, { status: 400 });
}

function guessMime(sourceType: 'pdf' | 'docx' | 'txt' | 'md'): string {
  switch (sourceType) {
    case 'pdf': return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'md': return 'text/markdown';
    case 'txt': return 'text/plain';
  }
}
