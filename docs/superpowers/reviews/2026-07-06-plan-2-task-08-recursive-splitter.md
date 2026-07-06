# Review: Plan 2 Task 08 — RecursiveSplitter

**Date:** 2026-07-06
**Author:** Claude (claude-haiku-4-5)
**Task:** Implement RecursiveSplitter wrapping LangChain text splitter (TDD)

---

## 1. Summary

Implemented `RecursiveSplitter` — a class that wraps `@langchain/textsplitters` `RecursiveCharacterTextSplitter` to split documents into ordered chunks with configurable chunk size and overlap. Page information is attached to chunks when available via `RawDoc.metadata.pageMap`. TDD was followed: 3 tests were written first and confirmed RED before implementation, then confirmed GREEN after.

---

## 2. TDD Evidence

**RED output** (before implementation):
```
FAIL  test/unit/lib/ingestion/splitters/RecursiveSplitter.test.ts
Error: Failed to resolve import "@/lib/ingestion/splitters/RecursiveSplitter"
Test Files  1 failed (1)
Tests  no tests
```

**GREEN output** (after implementation):
```
Test Files  1 passed (1)
     Tests  3 passed (3)
  Duration  2.04s
```

All 3 tests passing:
1. `splits a long doc into multiple ordered chunks`
2. `preserves overlap between adjacent chunks`
3. `attaches page from pageMap when chunk falls within page range`

**Typecheck:** 0 errors

---

## 3. Implementation Strategy

### RecursiveSplitter Class
- **Location:** `src/lib/ingestion/splitters/RecursiveSplitter.ts`
- **Pattern:** Implements `ChunkSplitter` interface, wraps LangChain splitter
- **Method:** `async split(doc: RawDoc): Promise<Chunk[]>`
- **Constructor Options:** `chunkSize` (default 800), `chunkOverlap` (default 150)
- **Separators:** Hierarchical priority: paragraph (`\n\n`), line (`\n`), sentence (`. `, `? `, `! `), word (` `), fallback (`''`)

### Split Algorithm
1. **Text Splitting:** Call `RecursiveCharacterTextSplitter.splitText(doc.content)` to produce string chunks
2. **Ordinal Assignment:** Map each chunk to ordinal based on array index
3. **Page Resolution:** For each chunk, locate its start position in the original content and find matching page range from `pageMap`
4. **Overlap Tracking:** Position tracking via `searchFrom` ensures chunks are found in order even with overlaps

### Position Tracking
- Use `indexOf(content.slice(0, 40), searchFrom)` to locate chunk start position in original content
- Leverage substring of first 40 chars to handle uniqueness while avoiding false negatives
- Advance `searchFrom` to `start + 1` to permit overlap detection in subsequent chunks

---

## 4. Test Coverage & Design

### Test 1: Long Document Splitting
- Input: 2500 'A' characters, chunk size 800, overlap 100
- Verifies: 
  - Produces >2 chunks
  - Each chunk has correct ordinal (0, 1, 2, ...)
  - No chunk exceeds 800 chars
- Purpose: Ensure basic splitting and ordering work

### Test 2: Overlap Preservation
- Input: 40 sentences (~1200 chars total), chunk size 200, overlap 50
- Verifies: Last 10 chars of chunk[0] appear as substring in chunk[1]
- Purpose: Confirm overlap semantics (shared content between consecutive chunks)

### Test 3: Page Mapping
- Input: Two concatenated pages (~1100 chars total), chunk size 400, overlap 50
- Verifies: Some chunks have `page: 1`, others have `page: 2`
- Purpose: Ensure page annotation from pageMap works correctly when chunks span page boundaries

---

## 5. Design Notes & Concerns

- **Position Search Strategy:** Using first 40 characters avoids matching on very short repeated content while remaining efficient. Edge case: if `content.slice(0, 40)` is unique but insufficient to locate the chunk, we fall back to previous `searchFrom` (no regression).
- **Page Boundary Logic:** Page assignment uses strict `start >= p.start && start < p.end`, which treats chunk start position as the key identifier. Chunks at exact page boundaries are assigned to the boundary's page.
- **LangChain Separators:** The separator hierarchy (`\n\n` → `\n` → `. ` → space → empty) is ideal for mixed markdown/prose content:
  - Prefers paragraph breaks over line breaks
  - Prefers sentence boundaries over word breaks
  - Degrades gracefully to character splitting for unsplittable segments
- **Default Parameters:** `chunkSize: 800` and `chunkOverlap: 150` (~19% overlap) balances context retention and chunk count. Overridable via constructor options.
- **No Metadata Preservation:** Current implementation does not forward `RawDoc.metadata` extras into chunks — only `page` is attached. This is acceptable per spec.
- **Async Signature:** Split is `async` to accommodate future async processing (e.g., embedding or external lookups) without API changes.
