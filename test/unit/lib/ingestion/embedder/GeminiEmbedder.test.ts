// test/unit/lib/ingestion/embedder/GeminiEmbedder.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GeminiEmbedder } from '@/lib/ingestion/embedder/GeminiEmbedder';

function mockOk(vectors: number[][]) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ embeddings: vectors.map((v) => ({ values: v })) }),
    text: async () => '',
    headers: new Headers(),
  })) as unknown as typeof fetch;
}

const vec768 = () => Array.from({ length: 768 }, () => Math.random());

describe('GeminiEmbedder', () => {
  it('returns one 768-dim vector per input text in order', async () => {
    const embedder = new GeminiEmbedder({
      apiKey: 'test-key',
      fetcher: mockOk([vec768(), vec768()]),
    });
    const out = await embedder.embedBatch(['hello', 'world']);
    expect(out).toHaveLength(2);
    out.forEach((v) => expect(v).toHaveLength(768));
  });

  it('splits large input into batches of `batchSize`', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const body = JSON.parse(init!.body as string) as { requests: unknown[] };
      const count = body.requests.length;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          embeddings: Array.from({ length: count }, () => ({ values: vec768() })),
        }),
        text: async () => '',
        headers: new Headers(),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const embedder = new GeminiEmbedder({ apiKey: 'k', fetcher, batchSize: 3 });
    const inputs = Array.from({ length: 7 }, (_, i) => `text ${i}`);
    const out = await embedder.embedBatch(inputs);
    expect(out).toHaveLength(7);
    // 3 batches: 3 + 3 + 1
    expect((fetcher as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(3);
  });

  it('retries on 429 with backoff, then succeeds', async () => {
    let call = 0;
    const fetcher = vi.fn(async () => {
      call++;
      if (call === 1) return { ok: false, status: 429, text: async (): Promise<string> => 'rate', headers: new Headers() };
      return {
        ok: true,
        status: 200,
        json: async () => ({ embeddings: [{ values: vec768() }] }),
        text: async (): Promise<string> => '',
        headers: new Headers(),
      };
    }) as unknown as typeof fetch;

    const embedder = new GeminiEmbedder({
      apiKey: 'k',
      fetcher,
      maxRetries: 3,
      backoffMs: 1, // fast for test
    });
    const out = await embedder.embedBatch(['x']);
    expect(out).toHaveLength(1);
    expect(call).toBe(2);
  });

  it('throws after exhausting retries on persistent 5xx', async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'server error',
      headers: new Headers(),
    })) as unknown as typeof fetch;

    const embedder = new GeminiEmbedder({ apiKey: 'k', fetcher, maxRetries: 2, backoffMs: 1 });
    await expect(embedder.embedBatch(['x'])).rejects.toThrow(/embed/i);
  });

  it('rejects if an embedding is not 768-dim', async () => {
    const embedder = new GeminiEmbedder({
      apiKey: 'k',
      fetcher: mockOk([[1, 2, 3]]),
    });
    await expect(embedder.embedBatch(['x'])).rejects.toThrow(/768/);
  });
});
