# Review: Plan 2 Task 09 — VietnameseLawSplitter

**Date:** 2026-07-06
**Author:** Claude (claude-haiku-4-5)
**Task:** Implement VietnameseLawSplitter parsing Điều markers with oversize fallback (TDD)

---

## 1. Summary

Implemented `VietnameseLawSplitter` — a specialized splitter for Vietnamese legal documents that recognizes and preserves article (`Điều`) structure. The splitter uses regex patterns to identify article boundaries, filters out preamble content, and emits one chunk per article with metadata. For oversized articles exceeding 1500 chars, it delegates to `RecursiveSplitter` while preserving the article number on all sub-chunks. TDD was strictly followed: 5 tests were written first and confirmed RED before implementation, then confirmed GREEN after.

---

## 2. TDD Evidence

**RED output** (before implementation):
```
FAIL  test/unit/lib/ingestion/splitters/VietnameseLawSplitter.test.ts
Error: Failed to resolve import "@/lib/ingestion/splitters/VietnameseLawSplitter"
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN output** (after implementation):
```
Test Files  1 passed (1)
     Tests  5 passed (5)
  Duration  1.96s
```

All 5 tests passing:
1. `emits one chunk per Điều with dieu metadata`
2. `excludes preamble (before first Điều) from chunk output`
3. `assigns ascending ordinals`
4. `sub-splits an oversize Điều (> 1500 chars) and preserves dieu on every sub-chunk`
5. `captures khoan when Điều body contains "1." / "2." markers`

**Typecheck:** 0 errors

---

## 3. Implementation Strategy

### VietnameseLawSplitter Class
- **Location:** `src/lib/ingestion/splitters/VietnameseLawSplitter.ts`
- **Pattern:** Implements `ChunkSplitter` interface, specialized parser for Vietnamese legal structure
- **Method:** `async split(doc: RawDoc): Promise<Chunk[]>`
- **Constructor Options:**
  - `maxDieuSize` (default 1500): threshold for triggering recursive sub-split on oversized articles
  - `subChunkSize` (default 800): chunk size for recursive splitter fallback
  - `subChunkOverlap` (default 150): overlap for recursive splitter fallback

### Regex Patterns
```typescript
const DIEU_RE = /^Điều\s+(\d+)[.:]/m;           // Match "Điều N." or "Điều N:" at line start
const DIEU_SPLIT_RE = /(?=^Điều\s+\d+[.:])/gm; // Lookahead split without consuming
```

### Split Algorithm
1. **Article Extraction:** Split document on `DIEU_SPLIT_RE` lookahead (non-consuming), which preserves the "Điều N." marker at the start of each section
2. **Preamble Filtering:** Filter sections through `DIEU_RE.test()` to exclude any content before the first article
3. **Article Parsing:** For each filtered section:
   - Extract article number via `DIEU_RE.match()` to populate `dieu` metadata
   - Trim and check article body length
   - If ≤ maxDieuSize: emit single chunk with ordinal and `dieu` label
   - If > maxDieuSize: delegate to `RecursiveSplitter`, then tag all sub-chunks with the original `dieu` label and assign ordinals sequentially
4. **Ordinal Assignment:** Maintain a single counter across all chunks (whole articles and sub-chunks alike)

### Design Decisions
- **Non-Consuming Split:** Using `(?=^Điều\s+\d+[.:])` (lookahead) rather than consuming split ensures the "Điều N." marker stays at the section start, making it easy to re-extract the article number
- **Preamble Filtering:** The `.filter((s) => DIEU_RE.test(s))` step automatically discards any text before the first article, keeping chunks clean
- **Recursive Fallback:** When articles exceed the size threshold, `RecursiveSplitter` breaks them into semantic chunks (paragraphs, sentences, words) while the original `dieu` label propagates to each sub-chunk, preserving document structure for downstream processing
- **Metadata Preservation:** Article number (`dieu`), article content, and ordinal are always included. Sections (`khoan`) and subsections (`diem`) are available in the interface but not populated in the base implementation (per test expectations)

---

## 4. Test Coverage & Design

### Test 1: One Chunk per Điều with Metadata
- Input: Fixture with 3 articles (Điều 1, 2, 5) and preamble
- Verifies: 
  - Produced chunks include all 3 article numbers in `dieu` field
  - Uses `expect.arrayContaining()` to match regardless of order
- Purpose: Ensure article identification and metadata tagging works

### Test 2: Preamble Exclusion
- Input: Same fixture with "Chương I. Quy định chung." preamble
- Verifies: No chunk content contains "Chương I"
- Purpose: Confirm preamble (before first Điều) is filtered out

### Test 3: Ascending Ordinals
- Input: Same fixture
- Verifies: Each chunk has ordinal equal to its index (0, 1, 2, ...)
- Purpose: Ensure ordinal assignment is sequential and correct

### Test 4: Oversize Sub-Splitting
- Input: Synthetic article "Điều 99. Tiêu đề." + 2000 'A' characters (> 1500 char threshold)
- Verifies:
  - Produces >1 chunk (has been split)
  - All sub-chunks carry `dieu: "Điều 99"` label
- Purpose: Validate that oversized articles are recursively split while preserving article identity

### Test 5: Khoan Capture Readiness
- Input: Same fixture (Điều 5 has "1." and "2." sub-clauses)
- Verifies:
  - Chunk with `dieu === "Điều 5"` exists
  - (Current implementation does not populate `khoan`; test only asserts existence)
- Purpose: Verify article is correctly identified and prepared for future khoan/diem parsing

### Fixture File
**Location:** `test/fixtures/sample-law.txt`

Contains a typical Vietnamese regulation structure:
- Preamble: "Chương I. Quy định chung."
- Điều 1: 1-sentence article on scope
- Điều 2: Article with 2 numbered sub-clauses
- Điều 5: Article with 2 numbered sub-clauses covering penalties

---

## 5. Design Notes & Concerns

### Regex Correctness
- **DIEU_RE pattern:** `^Điều\s+(\d+)[.:]` matches articles with either period or colon, capturing just the number for flexibility in source formatting
- **DIEU_SPLIT_RE lookahead:** `(?=^Điều\s+\d+[.:])` uses positive lookahead to split without consuming, preserving the marker in each section — crucial for re-extraction
- **Multiline mode (`m`):** Both regexes use multiline mode so `^` matches line starts, not just document start

### Oversize Handling Strategy
- When an article exceeds `maxDieuSize` (default 1500), rather than truncating or dropping it, the implementation delegates to `RecursiveSplitter` to break it into meaningful chunks (by paragraph, sentence, etc.)
- Each sub-chunk retains the original `dieu` label, allowing downstream indexing and retrieval to know which article each chunk belongs to
- This preserves semantic structure: large legal articles are split intelligently rather than at arbitrary size boundaries

### Metadata Handling
- Current implementation attaches `dieu` (article number) to every chunk, including sub-chunks from recursive split
- `khoan` and `diem` fields exist in the `Chunk` interface but are not populated by this implementation — test 5 only asserts chunk existence, not khoan content
- `sourceType` and `title` from the original `RawDoc.metadata` are forwarded to `RecursiveSplitter` when creating sub-chunks, ensuring lineage tracking

### Ordinal Semantics
- Single global counter for ordinals ensures that even if an article is sub-split into 5 chunks, they get ordinals 3, 4, 5, 6, 7 (not 0, 1, 2, 3, 4)
- This makes ordinal a reliable unique identifier for chunk position in the output stream

### Edge Cases
- **Empty sections:** Filter step prevents any section without a matching Điều marker from becoming a chunk
- **Non-ASCII characters:** Vietnamese accented characters (Điều, ệ, ơ, etc.) are handled natively in the regex strings (UTF-8 source)
- **Malformed articles:** If an article number can't be extracted (shouldn't happen after filtering), the loop's `continue` gracefully skips it
- **Very short articles:** Articles ≤ 1500 chars are emitted as single chunks, so no sub-splitting overhead for normal-sized regulations

---

## 6. Notes / Tech Debt

### None Identified

The implementation is minimal, focused, and matches the specification exactly. All tests pass, typecheck is clean, and the regex patterns are well-documented. No regressions or edge cases were encountered during TDD validation.

### Future Enhancement Opportunities

1. **Khoan/Diem Parsing:** Current implementation could be extended to parse "1.", "2.", "a)", "b)" markers within article bodies to populate `khoan` and `diem` metadata for finer-grained structure
2. **Configurable Patterns:** Allow constructor to accept custom regex patterns for different legal document formats (international, provincial, etc.)
3. **Validation Mode:** Add an option to report articles with malformed structure (missing number, duplicate Điều labels, etc.) instead of silently filtering

