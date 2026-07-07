import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import type { ChunkSplitter } from '@/lib/ingestion/splitters/ChunkSplitter';
import type { Embedder } from '@/lib/ingestion/embedder/Embedder';
import type { ChunkStore, ChunkWithEmbedding } from '@/lib/ingestion/store/ChunkStore';
import { LoaderFactory } from '@/lib/ingestion/loaders/LoaderFactory';
import { SplitterFactory } from '@/lib/ingestion/splitters/SplitterFactory';
import { GeminiEmbedder } from '@/lib/ingestion/embedder/GeminiEmbedder';
import { PgVectorStore } from '@/lib/ingestion/store/PgVectorStore';
import { IngestionError, type LoaderInput, type RawDoc } from '@/lib/ingestion/types';
import type { Database } from '@/types/database';

export interface IngestionPipelineDeps {
  loaderFor: (input: LoaderInput) => Promise<DocumentLoader>;
  splitterFor: (doc: RawDoc) => ChunkSplitter;
  embedder: Embedder;
  store: ChunkStore;
}

export class IngestionPipeline {
  constructor(private deps: IngestionPipelineDeps) {}

  async run(documentId: string, input: LoaderInput): Promise<{ chunkCount: number }> {
    await this.deps.store.updateDocumentStatus(documentId, 'processing');

    try {
      const loader = await this.deps.loaderFor(input);
      const doc = await loader.load(input);

      const splitter = this.deps.splitterFor(doc);
      const chunks = await splitter.split(doc);
      if (chunks.length === 0) {
        throw new IngestionError('Splitter produced no chunks', 'split');
      }

      const embeddings = await this.deps.embedder.embedBatch(chunks.map((c) => c.content));
      if (embeddings.length !== chunks.length) {
        throw new IngestionError('Embedding count mismatch', 'embed');
      }

      const withEmbeddings: ChunkWithEmbedding[] = chunks.map((c, i) => ({
        ...c,
        embedding: embeddings[i]!,
      }));

      await this.deps.store.replaceChunks(documentId, withEmbeddings);
      await this.deps.store.updateDocumentStatus(documentId, 'ready');
      return { chunkCount: chunks.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.deps.store.updateDocumentStatus(documentId, 'failed', msg);
      throw err;
    }
  }

  /** Default production wiring. */
  static build(opts: { client: SupabaseClient<Database> }): IngestionPipeline {
    const loaderFactory = new LoaderFactory();
    const splitterFactory = new SplitterFactory();
    return new IngestionPipeline({
      loaderFor: (input) => loaderFactory.forInput(input),
      splitterFor: (doc) => splitterFactory.forDoc(doc),
      embedder: new GeminiEmbedder(),
      store: new PgVectorStore(opts.client),
    });
  }
}
