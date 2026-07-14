import type { Embedder } from '@/lib/ingestion/embedder/Embedder';
import { IngestionError } from '@/lib/ingestion/types';

const MODEL = 'gemini-embedding-001';
const EXPECTED_DIM = 768;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`;

export interface GeminiEmbedderOptions {
  apiKey?: string;
  fetcher?: typeof fetch;
  batchSize?: number;
  maxRetries?: number;
  backoffMs?: number;
}

interface EmbedResponse {
  embeddings: Array<{ values: number[] }>;
}

export class GeminiEmbedder implements Embedder {
  private apiKeyOverride?: string;
  private fetcher: typeof fetch;
  private batchSize: number;
  private maxRetries: number;
  private backoffMs: number;
  private resolvedApiKey: string | null = null;

  constructor(opts: GeminiEmbedderOptions = {}) {
    this.apiKeyOverride = opts.apiKey;
    this.fetcher = opts.fetcher ?? fetch;
    this.batchSize = opts.batchSize ?? 100;
    this.maxRetries = opts.maxRetries ?? 3;
    this.backoffMs = opts.backoffMs ?? 500;
  }

  private async getApiKey(): Promise<string> {
    if (this.resolvedApiKey) return this.resolvedApiKey;
    if (this.apiKeyOverride) {
      this.resolvedApiKey = this.apiKeyOverride;
      return this.resolvedApiKey;
    }
    // Import lazily so this file can be imported by tests that don't set GOOGLE_GENERATIVE_AI_API_KEY.
    const { serverEnv } = await import('@/lib/env');
    this.resolvedApiKey = serverEnv.GOOGLE_GENERATIVE_AI_API_KEY;
    return this.resolvedApiKey;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const vectors = await this.callWithRetry(batch);
      for (const v of vectors) {
        if (v.length !== EXPECTED_DIM) {
          throw new IngestionError(`Expected ${EXPECTED_DIM}-dim embedding, got ${v.length}`, 'embed');
        }
        results.push(v);
      }
    }
    return results;
  }

  private async callWithRetry(batch: string[]): Promise<number[][]> {
    const apiKey = await this.getApiKey();
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= this.maxRetries) {
      const url = `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
      const body = {
        requests: batch.map((text) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EXPECTED_DIM,
        })),
      };

      let response: Awaited<ReturnType<typeof fetch>>;
      try {
        response = await this.fetcher(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (err) {
        lastErr = err;
        await this.sleep(this.backoffMs * 2 ** attempt);
        attempt++;
        continue;
      }

      if (response.ok) {
        const json = (await response.json()) as EmbedResponse;
        if (json.embeddings.length !== batch.length) {
          throw new IngestionError(
            `Expected ${batch.length} embeddings, got ${json.embeddings.length}`,
            'embed',
          );
        }
        return json.embeddings.map((e) => e.values);
      }

      // Retry on 429 + 5xx; fail fast on 4xx.
      const detail = await response.text();
      if (response.status !== 429 && response.status < 500) {
        throw new IngestionError(`Gemini embed failed ${response.status}: ${detail}`, 'embed');
      }

      lastErr = new Error(`status ${response.status}: ${detail}`);
      await this.sleep(this.backoffMs * 2 ** attempt);
      attempt++;
    }

    const lastMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new IngestionError(`Gemini embed exhausted retries (${lastMsg})`, 'embed', lastErr);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
