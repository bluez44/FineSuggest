import { describe, it, expect, vi } from 'vitest';
import { PgVectorStore } from '@/lib/ingestion/store/PgVectorStore';
import type { ChunkWithEmbedding } from '@/lib/ingestion/store/ChunkStore';

interface FakeCall {
  table: string;
  op: 'delete' | 'insert' | 'update';
  arg?: unknown;
  filter?: Record<string, unknown>;
}

function fakeClient() {
  const calls: FakeCall[] = [];
  const client = {
    from(table: string) {
      return {
        delete() {
          calls.push({ table, op: 'delete' });
          return { eq: (col: string, val: unknown) => { calls.at(-1)!.filter = { [col]: val }; return { error: null }; } };
        },
        insert(rows: unknown) {
          calls.push({ table, op: 'insert', arg: rows });
          return { error: null };
        },
        update(patch: unknown) {
          calls.push({ table, op: 'update', arg: patch });
          return { eq: (col: string, val: unknown) => { calls.at(-1)!.filter = { [col]: val }; return { error: null }; } };
        },
      };
    },
  };
  return { client, calls };
}

const vec = () => Array.from({ length: 768 }, () => 0.1);

describe('PgVectorStore', () => {
  it('replaceChunks deletes existing chunks then inserts new', async () => {
    const { client, calls } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = new PgVectorStore(client as any);
    const chunks: ChunkWithEmbedding[] = [
      { content: 'a', ordinal: 0, embedding: vec(), dieu: 'Điều 1' },
      { content: 'b', ordinal: 1, embedding: vec() },
    ];
    await store.replaceChunks('doc-1', chunks);

    expect(calls[0]).toMatchObject({ table: 'chunks', op: 'delete', filter: { document_id: 'doc-1' } });
    expect(calls[1]).toMatchObject({ table: 'chunks', op: 'insert' });
    const inserted = calls[1]!.arg as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({ document_id: 'doc-1', ordinal: 0, content: 'a', dieu: 'Điều 1' });
    expect(inserted[0]!.embedding).toMatch(/^\[/); // pgvector string literal
  });

  it('updateDocumentStatus writes status + error_message + updated_at trigger runs', async () => {
    const { client, calls } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = new PgVectorStore(client as any);
    await store.updateDocumentStatus('doc-1', 'failed', 'boom');
    expect(calls[0]).toMatchObject({
      table: 'documents',
      op: 'update',
      arg: { status: 'failed', error_message: 'boom' },
      filter: { id: 'doc-1' },
    });
  });

  it('updateDocumentStatus with ready clears error_message', async () => {
    const { client, calls } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = new PgVectorStore(client as any);
    await store.updateDocumentStatus('doc-1', 'ready');
    expect((calls[0]!.arg as Record<string, unknown>).error_message).toBeNull();
  });

  it('replaceChunks with empty array only deletes (no insert)', async () => {
    const { client, calls } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = new PgVectorStore(client as any);
    await store.replaceChunks('doc-1', []);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ op: 'delete' });
  });
});
