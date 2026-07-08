# Plan 3 Task 2 Review: Strict-RAG System Prompt & Chat Message Builder

**Date:** 2026-07-08  
**Task:** Plan 3 Task 2 — RAG Chat: System Prompt + Message Builder  
**Status:** COMPLETE

## What

Created two files in the new `src/lib/rag/` directory:

1. **`systemPrompt.ts`** — Exports `strictRagSystemPrompt`, a Vietnamese system prompt that instructs the model to answer ONLY from provided CONTEXT blocks, never hallucinating or using external knowledge.

2. **`prompt.ts`** — Exports:
   - `ChunkForPrompt` interface: structural type for RAG chunks (mirrors what Task 4 will export as `RetrievedChunk`, preventing an import cycle)
   - `HistoryMessage` interface: conversation history message shape
   - `buildChatMessages()` function: pure function that formats retrieved chunks + history + question into `{ system: string; messages: ModelMessage[] }`

## Why

Plan 3 (RAG Chat) requires a strict RAG system to maintain accuracy and legal compliance for Vietnamese traffic law. The system prompt ensures no hallucinations; `buildChatMessages()` bundles context chunks with a [n] reference system for citations, prepends conversation history, and appends the new user question—all in one pure, testable function.

## Files Changed

- **Created:** `src/lib/rag/systemPrompt.ts`
  - Single export: `strictRagSystemPrompt` (Vietnamese, verbatim from brief)

- **Created:** `src/lib/rag/prompt.ts`
  - Exports: `ChunkForPrompt`, `HistoryMessage`, `buildChatMessages()`
  - `buildChatMessages()` formats chunks with `[n] (Điều X, Khoản Y, Document Title) Content`, omitting null label parts
  - Returns `{ system, messages }` ready for `ai.generateText()` call

- **Created:** `test/unit/lib/rag/prompt.test.ts`
  - 5 test cases: system prompt embedding, null label omission, history prepending, empty history, empty retrieved chunks
  - Test chunk factory uses `'key' in over ? over.key : default` pattern to allow explicit `null` overrides (corrects typo in brief's `??` operator)

## How to Verify

1. **Task test passes:**
   ```bash
   npx vitest run test/unit/lib/rag/prompt.test.ts
   ```
   Expected: `5 passed`

2. **Full test suite passes:**
   ```bash
   npx vitest run
   ```
   Expected: `60 passed, 1 skipped`

3. **Typecheck clean:**
   ```bash
   npx tsc --noEmit
   ```
   Expected: no errors

## Implementation Notes

### Pure Function Design

`buildChatMessages()` has no side effects, no I/O, no state mutation. It's a pure composition function:
- Input: `retrieved: ChunkForPrompt[]`, `history: HistoryMessage[]`, `question: string`
- Output: `{ system: string; messages: ModelMessage[] }`

### Label Formatting

`labelParts()` helper filters and joins chunk metadata:
- Includes: `dieu`, `khoan`, `diem`, `documentTitle` (in order)
- Omits: any `null`, `undefined`, or empty-string fields
- Result: `[n] (Điều 5, Khoản 1, Nghị định 100/2019) Nội dung...`

### CONTEXT Block Structure

System prompt is formatted as:
```
[strictRagSystemPrompt]

CONTEXT:
[1] (Điều 1, Khoản 1, Doc Title) Content chunk 1

[2] (Điều 2, Khoản 1, Doc Title) Content chunk 2
```

Empty retrieved list still produces valid CONTEXT block (empty but present).

### No Import Cycle

`ChunkForPrompt` is declared locally in `prompt.ts` to avoid importing from `retrieve.ts` (created in Task 4). Task 4 will replace this via:
```typescript
import type { Pick<RetrievedChunk, 'content' | 'dieu' | 'khoan' | 'diem' | 'documentTitle'> } from './retrieve';
type ChunkForPrompt = ...;
```

This pattern is documented in a code comment in `prompt.ts`.

### Test Factory Correction

Brief's chunk factory used `over.khoan ?? 'Khoản 1'`, which would always fall back to the default even when explicitly passed `null`. Corrected to `'khoan' in over ? over.khoan : 'Khoản 1'` with type cast to maintain `string | null` type safety. This allows the test to verify that null label parts are omitted (test case: "omits null label parts").

## Deviations

One deviation from brief: Test chunk factory patternchanged from `??` (nullish coalescing) to `'key' in over ? ... : default` to correctly handle explicit `null` overrides, ensuring test case "omits null label parts" passes. The functional intent remains identical.

## Tech Debt & Future Work

1. **Task 4 integration:** Replace local `ChunkForPrompt` with `import type` from `retrieve.ts` once Task 4 lands. Update `prompt.ts` line ~10 comment.

2. **Chunk content truncation:** Future task may add length limits to chunk content before embedding (e.g., `content: string & { maxLength: 512 }`), avoiding oversized context blocks.

3. **Fallback handling:** Could add a config option to include a fallback message in CONTEXT if retrieved is empty (currently silent).

---

Generated with Claude Code.
