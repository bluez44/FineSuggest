import type { Chunk } from '@/lib/ingestion/types';

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

export interface ChunkStore {
  /** Replace ALL chunks for `documentId` with the given set (delete + insert). */
  replaceChunks(documentId: string, chunks: ChunkWithEmbedding[]): Promise<void>;

  /** Update document row's status (+ error message on failure). */
  updateDocumentStatus(
    documentId: string,
    status: 'processing' | 'ready' | 'failed',
    errorMessage?: string | null,
  ): Promise<void>;
}
