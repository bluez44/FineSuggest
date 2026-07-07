import type { SupabaseClient } from '@supabase/supabase-js';
import { IngestionError } from '@/lib/ingestion/types';
import type { ChunkStore, ChunkWithEmbedding } from '@/lib/ingestion/store/ChunkStore';
import type { Database } from '@/types/database';

/** Serialize a JS number array to pgvector string literal: [1,2,3] */
function toPgVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

export class PgVectorStore implements ChunkStore {
  constructor(private client: SupabaseClient<Database>) {}

  async replaceChunks(documentId: string, chunks: ChunkWithEmbedding[]): Promise<void> {
    const del = await this.client.from('chunks').delete().eq('document_id', documentId);
    if (del.error) throw new IngestionError('Failed to delete chunks', 'store', del.error);

    if (chunks.length === 0) return;

    const rows = chunks.map((c) => ({
      document_id: documentId,
      ordinal: c.ordinal,
      content: c.content,
      embedding: toPgVector(c.embedding),
      dieu: c.dieu ?? null,
      khoan: c.khoan ?? null,
      diem: c.diem ?? null,
      page: c.page ?? null,
      metadata: (c.metadata ?? {}) as Record<string, never>,
    }));

    const ins = await this.client.from('chunks').insert(rows);
    if (ins.error) throw new IngestionError('Failed to insert chunks', 'store', ins.error);
  }

  async updateDocumentStatus(
    documentId: string,
    status: 'processing' | 'ready' | 'failed',
    errorMessage: string | null = null,
  ): Promise<void> {
    const patch = {
      status,
      error_message: status === 'ready' ? null : errorMessage,
    };
    const res = await this.client.from('documents').update(patch).eq('id', documentId);
    if (res.error) throw new IngestionError('Failed to update document status', 'store', res.error);
  }
}
