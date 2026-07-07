# Plan 2 Task 13 Review: IngestionPipeline Orchestrator (TDD)

**Date:** 2026-07-06  
**Task:** Plan 2 Task 13 — IngestionPipeline orchestrator with static build factory  
**Status:** COMPLETE

## Task

Implement the orchestration layer that ties together all four ingestion components (Loader, Splitter, Embedder, Store) using Test-Driven Development:
1. **Create test file** with 3 tests using fake implementations of all four dependencies
2. **Implement `IngestionPipeline` class** with `run()` method and static `build()` factory
3. **Verify:** 3 passing tests, typecheck clean, full suite still passes

## What Changed

- **Created:** `test/unit/lib/ingestion/IngestionPipeline.test.ts`
  - 3 passing tests using hand-rolled fake loader, splitter, embedder, store (no real API calls)
  - Test 1: Happy path (`processing` → `replaceChunks` → `ready`)
  - Test 2: Error recovery (marks `failed` and rethrows when loader throws)
  - Test 3: Validation (marks `failed` when splitter returns 0 chunks)

- **Created:** `src/lib/ingestion/IngestionPipeline.ts`
  - Implements orchestration via dependency injection (`IngestionPipelineDeps` interface)
  - `run(documentId, input)` method coordinates full pipeline lifecycle
  - Static factory `IngestionPipeline.build({ client })` wires production stack
  - Properly handles errors: marks document as `failed`, captures error message, rethrows

## How to Verify

1. All 3 task tests pass:
   ```bash
   npm test -- --run IngestionPipeline
   ```
   Expected: **3 passed**

2. Full test suite passes (all 13 files, 48 tests):
   ```bash
   npm test -- --run
   ```
   Expected: **13 passed, 48 passed**

3. Typecheck passes:
   ```bash
   npm run typecheck
   ```
   Expected: 0 errors (clean exit)

4. Files exist and are importable:
   ```bash
   ls -la src/lib/ingestion/IngestionPipeline.ts
   ls -la test/unit/lib/ingestion/IngestionPipeline.test.ts
   ```

## Key Implementation Details

### Pipeline Lifecycle

The `run()` method follows this state machine:

1. **Mark processing:** `updateDocumentStatus(documentId, 'processing')`
2. **Load document:** Obtains loader via factory, calls `loader.load(input)`
3. **Split into chunks:** Obtains splitter via factory, calls `splitter.split(doc)`
4. **Validate chunks:** Throws `IngestionError` if 0 chunks returned
5. **Embed chunks:** Calls `embedder.embedBatch(contentArray)` and validates count
6. **Store chunks:** Calls `store.replaceChunks(documentId, chunksWithEmbeddings)`
7. **Mark ready:** `updateDocumentStatus(documentId, 'ready')`
8. **Error recovery:** Catches any error, marks `failed` with error message, rethrows

### Dependency Injection

`IngestionPipelineDeps` interface provides four injected functions/objects:

```typescript
export interface IngestionPipelineDeps {
  loaderFor: (input: LoaderInput) => Promise<DocumentLoader>;
  splitterFor: (doc: RawDoc) => ChunkSplitter;
  embedder: Embedder;
  store: ChunkStore;
}
```

This enables:
- **Test mode:** Inject fake implementations for deterministic testing
- **Production mode:** `build()` factory wires real LoaderFactory, SplitterFactory, GeminiEmbedder, PgVectorStore

### Static Build Factory

`IngestionPipeline.build({ client })` constructs the production stack:

```typescript
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
```

### Error Message Handling

- `Error` objects: Extract `.message` property
- Non-Error objects: Convert via `String(err)`
- Passed to `store.updateDocumentStatus(documentId, 'failed', msg)`
- Error is re-thrown after status update (caller's responsibility to handle)

### Test Fakes

- **OkLoader:** Returns a simple `RawDoc` with 'body' content
- **TwoChunkSplitter:** Returns exactly 2 chunks
- **FakeEmbedder:** Returns 768-dimensional zero vectors (matching real Gemini embeddings)
- **RecordingStore:** Records all status updates and replaceChunks calls, exposes `.events` array and `.chunks`

## Deviations

**None.** Implementation follows the brief verbatim:
- TDD approach: test-first → implementation
- 3 tests → 3 passed
- Typecheck: 0 errors
- Full suite: 13 test files, 48 tests (all prior tests still pass)
- File paths and code match brief exactly

## Notes / Tech Debt

- **Chunk embedding mapping:** The pipeline assumes `embeddings` array has same length and order as `chunks`. This is validated at runtime (`if (embeddings.length !== chunks.length)`).

- **Status → error message relationship:** Only the `failed` status can carry an error message. The interface allows optional error message on other statuses, but in practice only `failed` uses it. This is handled correctly but could benefit from type refinement in a future update.

- **Sequential vs. parallel:** Currently the pipeline processes sequentially (load → split → embed → store). For very large documents, parallel embedding of chunks could improve performance; deferred to future optimization.

- **Orchestration extensibility:** The `IngestionPipelineDeps` interface is designed to support alternative implementations (e.g., streaming, batching, validation layers) via dependency substitution.

---

Generated with Claude Code.
