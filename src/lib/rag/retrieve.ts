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
