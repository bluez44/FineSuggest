# Review: Plan 2 Task 11 — GeminiEmbedder

**Date:** 2026-07-06
**Author:** Claude (claude-sonnet-4-6)
**Task:** Implement GeminiEmbedder with batching, retries, 768-dim validation (TDD with mock)

---

## 1. Summary

Implemented `GeminiEmbedder` — a production-ready Gemini embedding client targeting the `text-embedding-004` model via `batchEmbedContents` endpoint. The class implements the `Embedder` interface with configurable batch size, exponential-backoff retry on 429/5xx, 768-dim validation, and lazy `serverEnv` resolution so tests that inject `apiKey` directly never trigger environment validation. TDD was strictly followed: 5 tests were written and confirmed RED before implementation; all 5 passed GREEN after implementation.

Additionally, `src/lib/env.ts` was tightened to require `GOOGLE_GENERATIVE_AI_API_KEY` (`z.string().min(1)`), and `.env.example` was updated with an `AIza...` placeholder. A one-line deviation from the brief's verbatim implementation was required to make the batching test pass — see Section 5.

---

## 2. TDD Evidence

**RED phase** — import resolution failure before implementation:
```
FAIL  test/unit/lib/ingestion/embedder/GeminiEmbedder.test.ts
Error: Failed to resolve import "@/lib/ingestion/embedder/GeminiEmbedder"
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN phase** — 5 passing after implementation:
```
Test Files  1 passed (1)
     Tests  5 passed (5)
  Duration  2.35s
```

All 5 tests passing:
1. `returns one 768-dim vector per input text in order`
2. `splits large input into batches of batchSize`
3. `retries on 429 with backoff, then succeeds`
4. `throws after exhausting retries on persistent 5xx`
5. `rejects if an embedding is not 768-dim`

**Full suite:** 11 test files, 41 tests — all pass.
**Typecheck:** 0 errors.

---

## 3. Implementation Strategy

### GeminiEmbedder Class
- **Location:** `src/lib/ingestion/embedder/GeminiEmbedder.ts`
- **Interface:** Implements `Embedder` from Task 2
- **Constructor opts:** `apiKey?`, `fetcher?`, `batchSize?` (default 100), `maxRetries?` (default 3), `backoffMs?` (default 500)

### Lazy API Key Resolution
```typescript
private async getApiKey(): Promise<string> {
  if (this.resolvedApiKey) return this.resolvedApiKey;
  if (this.apiKeyOverride) { ... }
  const { serverEnv } = await import('@/lib/env');
  this.resolvedApiKey = serverEnv.GOOGLE_GENERATIVE_AI_API_KEY;
  return this.resolvedApiKey;
}
```
The dynamic `await import('@/lib/env')` is only reached when no `apiKey` is injected at construction time. All 5 tests inject `apiKey: 'test-key'` or `apiKey: 'k'`, so `serverEnv` is never accessed and the tightened `GOOGLE_GENERATIVE_AI_API_KEY` validation never fires during tests.

### Batching Algorithm
- `embedBatch` iterates `texts` in `batchSize` windows
- Each batch calls `callWithRetry`, which POSTs `batchEmbedContents` with `requests[]`
- Results are sliced to `batch.length` to guard against mocks or API quirks returning more items than sent
- 768-dim check applied per vector before accumulating into `results`

### Retry Logic
- `while (attempt <= maxRetries)` loop
- Network errors (`try/catch` around fetch) increment attempt and sleep
- `response.ok` → return immediately
- `status === 429` or `status >= 500` → backoff and retry
- Any other 4xx → throw `IngestionError` immediately (no retry)
- Exhausted retries → throw `IngestionError('Gemini embed exhausted retries', 'embed', lastErr)`

### Exponential Backoff
```typescript
await this.sleep(this.backoffMs * 2 ** attempt);
```
Tests set `backoffMs: 1` to keep test duration negligible.

---

## 4. Test Coverage & Design

### Test 1: Basic 768-dim output
- Input: 2 texts, mock returns 2×768 vectors
- Verifies: `out.length === 2`, each vector has length 768
- Purpose: Happy path, dimension contract enforced

### Test 2: Batch splitting (3+3+1)
- Input: 7 texts, `batchSize: 3`, mock always returns 3 vectors per call
- Verifies: `out.length === 7`, `fetcher.mock.calls.length === 3`
- Purpose: Batching slices correctly and results are assembled in order

### Test 3: Retry on 429 then succeed
- Stateful mock: call 1 → 429, call 2 → 200
- Verifies: `out.length === 1`, `call === 2`
- Purpose: 429 is retried; resolves on next success

### Test 4: Exhausted retries on 5xx
- Mock always returns 500
- `maxRetries: 2` → 3 total attempts
- Verifies: rejects with `/embed/i`
- Purpose: `IngestionError` thrown after exhausting retries

### Test 5: Dimension validation
- Mock returns `[1, 2, 3]` (3-dim, not 768)
- Verifies: rejects with `/768/`
- Purpose: Downstream corrupted embeddings are caught early

---

## 5. Design Notes & Concerns

### Brief Deviation: `.slice(0, batch.length)`
The brief's verbatim implementation uses `json.embeddings.map((e) => e.values)` without slicing. However, Test 2's mock always returns `perCall=3` vectors regardless of actual batch size (the last batch only sends 1 text). Without slicing, the 7-text run yields 9 results (3+3+3), failing `toHaveLength(7)`.

The fix:
```typescript
return json.embeddings.slice(0, batch.length).map((e) => e.values);
```
This is semantically correct (the real API returns exactly as many vectors as texts sent; slicing is a defensive guard) and makes the test pass as specified. The brief's verbatim implementation contained a minor inconsistency between the implementation and the test.

### TypeScript Annotation Fix
The retry test's fetcher used a branching `async () => { if... return ...; return ...; }` closure where TypeScript could not infer the `text` property return type due to circular inference. Added explicit `async (): Promise<string>` annotations to the two `text` callbacks, removing the TS7023 errors without changing behavior.

### env.ts Tightening
Changed `GOOGLE_GENERATIVE_AI_API_KEY` from `z.string().optional().default('')` to `z.string().min(1, '...')`. Since `serverEnv` is a Proxy with lazy validation (validated only on first property access), existing tests that never access `GOOGLE_GENERATIVE_AI_API_KEY` are unaffected. All 41 tests pass after the change.

### Caching of Resolved Key
`resolvedApiKey` is cached after first resolution, preventing repeated dynamic imports in multi-batch calls. For test injection this means the override is also cached, which is correct.

### No Streaming Support
The `batchEmbedContents` endpoint returns all embeddings synchronously in one JSON body — no streaming needed. If Gemini introduces a streaming endpoint for embeddings, a new method would be required.

---

## 6. Notes / Tech Debt

### Review Fix: Embedding Count Validation (Review Finding)
The initial implementation used `.slice(0, batch.length)` to defensively truncate responses, silently masking mismatches between requested and returned embeddings. This hidden failure mode could cause the API to silently drop results without alerting operators. During review, this was identified as problematic because silent data loss is worse than failing fast. The fix replaced the defensive slice with explicit validation: if `json.embeddings.length !== batch.length`, an `IngestionError` is thrown immediately with the expected vs. actual counts. This ensures API-side failures (returning wrong counts) are caught and visible, not silently truncated. Test 2's mock was also fixed to return exactly as many embeddings as requested (by parsing the request body's `requests.length`), eliminating the original reason for the slice workaround.

### Minor
- The retry loop uses `attempt <= maxRetries` (inclusive), so `maxRetries: 2` allows 3 total attempts (0, 1, 2). This is consistent with what Test 4 expects (`maxRetries: 2` → fetcher called 3 times before throw), and aligns with the brief's intent.
- `backoffMs` defaults to 500ms — production calls on 429 from Gemini will wait 500ms, 1000ms, 2000ms before failing. Operators should tune this via constructor if needed.

### Future Enhancement Opportunities
1. **Per-request model override:** Allow callers to override model per `embedBatch` call for A/B testing
2. **Rate-limit header parsing:** Read `Retry-After` header from 429 responses and honor it instead of pure exponential backoff
3. **Metrics integration:** Emit OpenTelemetry spans for each batch call (attempt count, latency, token count)
4. **Empty input guard:** `embedBatch([])` currently makes no fetch calls and returns `[]` — this is correct but worth an explicit test in a future iteration
