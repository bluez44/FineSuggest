import { describe, it, expect, vi } from 'vitest';
import { retrieveChunks, MIN_SIMILARITY } from '@/lib/rag/retrieve';

function makeClient(rpcRes: { data: unknown; error: unknown }, docsRes?: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcRes);
  const inFn = vi.fn().mockResolvedValue(docsRes ?? { data: [], error: null });
  const selectDocs = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select: selectDocs }));
  return { rpc, from } as never;
}

describe('retrieveChunks', () => {
  it('filters chunks with similarity below MIN_SIMILARITY', async () => {
    const rows = [
      { id: 'a', document_id: 'd1', content: 'ok', dieu: 'Điều 1', khoan: null, diem: null, page: null, similarity: 0.9 },
      { id: 'b', document_id: 'd1', content: 'low', dieu: 'Điều 2', khoan: null, diem: null, page: null, similarity: 0.3 },
    ];
    const client = makeClient(
      { data: rows, error: null },
      { data: [{ id: 'd1', title: 'Doc 1' }], error: null },
    );
    const res = await retrieveChunks([0.1, 0.2], 'user-1', client);
    expect(res).toHaveLength(1);
    expect(res[0]!.id).toBe('a');
    expect(res[0]!.similarity).toBeGreaterThanOrEqual(MIN_SIMILARITY);
    expect(res[0]!.documentTitle).toBe('Doc 1');
  });

  it('returns [] on RPC empty', async () => {
    const client = makeClient({ data: [], error: null });
    const res = await retrieveChunks([0.1, 0.2], 'user-1', client);
    expect(res).toEqual([]);
  });

  it('throws on RPC error', async () => {
    const client = makeClient({ data: null, error: { message: 'boom' } });
    await expect(retrieveChunks([0.1, 0.2], 'user-1', client)).rejects.toThrow(/boom|retrieve/i);
  });

  it('enriches documentTitle from the documents.select().in() second query', async () => {
    const rows = [
      { id: 'a', document_id: 'd1', content: 'x', dieu: null, khoan: null, diem: null, page: null, similarity: 0.9 },
      { id: 'b', document_id: 'd2', content: 'y', dieu: null, khoan: null, diem: null, page: null, similarity: 0.85 },
    ];
    const client = makeClient(
      { data: rows, error: null },
      { data: [{ id: 'd1', title: 'One' }, { id: 'd2', title: 'Two' }], error: null },
    );
    const res = await retrieveChunks([0], 'user-1', client);
    expect(res.map((r) => r.documentTitle).sort()).toEqual(['One', 'Two']);
  });
});
