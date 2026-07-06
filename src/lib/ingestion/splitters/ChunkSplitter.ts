import type { Chunk, RawDoc } from '@/lib/ingestion/types';

/** Strategy: split a RawDoc into ordered Chunks (no embeddings yet). */
export interface ChunkSplitter {
  split(doc: RawDoc): Promise<Chunk[]>;
}
