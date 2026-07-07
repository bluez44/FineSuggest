import { describe, it, expect } from 'vitest';
import { IngestionPipeline } from '@/lib/ingestion/IngestionPipeline';
import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import type { ChunkSplitter } from '@/lib/ingestion/splitters/ChunkSplitter';
import type { Embedder } from '@/lib/ingestion/embedder/Embedder';
import type { ChunkStore, ChunkWithEmbedding } from '@/lib/ingestion/store/ChunkStore';
import type { RawDoc, Chunk, LoaderInput } from '@/lib/ingestion/types';

class OkLoader implements DocumentLoader {
  async load(_i: LoaderInput): Promise<RawDoc> {
    return { content: 'body', metadata: { sourceType: 'txt', title: 't' } };
  }
}

class TwoChunkSplitter implements ChunkSplitter {
  async split(_d: RawDoc): Promise<Chunk[]> {
    return [
      { content: 'a', ordinal: 0 },
      { content: 'b', ordinal: 1 },
    ];
  }
}

class FakeEmbedder implements Embedder {
  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => Array.from({ length: 768 }, () => 0));
  }
}

class RecordingStore implements ChunkStore {
  events: string[] = [];
  chunks: ChunkWithEmbedding[] = [];
  async replaceChunks(_id: string, c: ChunkWithEmbedding[]): Promise<void> {
    this.events.push('replace');
    this.chunks = c;
  }
  async updateDocumentStatus(_id: string, status: 'processing' | 'ready' | 'failed', err?: string | null): Promise<void> {
    this.events.push(`status:${status}${err ? `:${err}` : ''}`);
  }
}

const factories = () => ({
  loaderFor: async (_i: LoaderInput) => new OkLoader(),
  splitterFor: (_d: RawDoc) => new TwoChunkSplitter(),
});

describe('IngestionPipeline', () => {
  it('runs happy path: processing → replaceChunks → ready', async () => {
    const store = new RecordingStore();
    const pipeline = new IngestionPipeline({
      loaderFor: factories().loaderFor,
      splitterFor: factories().splitterFor,
      embedder: new FakeEmbedder(),
      store,
    });
    const result = await pipeline.run('doc-1', {
      kind: 'buffer',
      buffer: Buffer.from('x'),
      filename: 'x.txt',
      mimeType: 'text/plain',
    });
    expect(result.chunkCount).toBe(2);
    expect(store.events).toEqual(['status:processing', 'replace', 'status:ready']);
    expect(store.chunks).toHaveLength(2);
    expect(store.chunks[0]!.embedding).toHaveLength(768);
  });

  it('marks failed and rethrows when loader throws', async () => {
    class BadLoader implements DocumentLoader {
      async load(): Promise<RawDoc> { throw new Error('parse fail'); }
    }
    const store = new RecordingStore();
    const pipeline = new IngestionPipeline({
      loaderFor: async () => new BadLoader(),
      splitterFor: factories().splitterFor,
      embedder: new FakeEmbedder(),
      store,
    });
    await expect(
      pipeline.run('doc-1', {
        kind: 'buffer',
        buffer: Buffer.from('x'),
        filename: 'x.txt',
        mimeType: 'text/plain',
      }),
    ).rejects.toThrow(/parse fail/);
    expect(store.events).toEqual(['status:processing', 'status:failed:parse fail']);
  });

  it('marks failed when splitter returns 0 chunks', async () => {
    class EmptySplitter implements ChunkSplitter {
      async split(): Promise<Chunk[]> { return []; }
    }
    const store = new RecordingStore();
    const pipeline = new IngestionPipeline({
      loaderFor: factories().loaderFor,
      splitterFor: () => new EmptySplitter(),
      embedder: new FakeEmbedder(),
      store,
    });
    await expect(
      pipeline.run('doc-1', {
        kind: 'buffer',
        buffer: Buffer.from('x'),
        filename: 'x.txt',
        mimeType: 'text/plain',
      }),
    ).rejects.toThrow(/no chunks/i);
    expect(store.events.at(-1)).toMatch(/^status:failed/);
  });
});
