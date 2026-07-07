# Review: Plan 2 Task 10 — SplitterFactory

**Date:** 2026-07-06
**Author:** Claude (claude-haiku-4-5)
**Task:** Implement SplitterFactory auto-selecting law vs recursive splitter (TDD)

---

## 1. Summary

Implemented `SplitterFactory` — a factory class that automatically selects the appropriate text splitter based on document content analysis. The factory detects Vietnamese legal document structure by counting `Điều N.` markers and routes to `VietnameseLawSplitter` when ≥ 2 markers are found, otherwise to `RecursiveSplitter`. TDD was strictly followed: 3 tests were written first and all passed on first implementation.

---

## 2. TDD Evidence

**Tests written first:**
```
Test Files  1 passed (1)
     Tests  3 passed (3)
Duration  4.95s
```

All 3 tests passing:
1. `picks VietnameseLawSplitter when text has 2+ Điều markers`
2. `picks RecursiveSplitter when no Điều markers`
3. `picks RecursiveSplitter with only 1 Điều (not enough signal)`

**Typecheck:** 0 errors

---

## 3. Implementation Strategy

### SplitterFactory Class
- **Location:** `src/lib/ingestion/splitters/SplitterFactory.ts`
- **Pattern:** Factory class implementing smart content-based routing
- **Method:** `forDoc(doc: RawDoc): ChunkSplitter`
- **Decision Logic:** Detects `Điều N.` pattern; uses `VietnameseLawSplitter` if ≥ 2 matches, else `RecursiveSplitter`

### Regex Pattern
```typescript
const DIEU_COUNT_RE = /^Điều\s+\d+[.:]/gm;
```
- Matches "Điều" followed by one or more spaces, one or more digits, and either period or colon
- Multiline mode (`m`) ensures `^` matches line starts
- Global flag (`g`) returns all matches for counting

### Selection Algorithm
1. **Pattern Matching:** Execute regex against `doc.content` to find all `Điều` markers
2. **Count Threshold:** If matches found and count ≥ 2, return `new VietnameseLawSplitter()`
3. **Default Fallback:** Otherwise return `new RecursiveSplitter()`

---

## 4. Test Coverage & Design

### Test 1: Law Splitter Selection (2+ Markers)
- Input: Document with "Điều 1. ...\nĐiều 2. ..."
- Verifies: `factory.forDoc()` returns instance of `VietnameseLawSplitter`
- Purpose: Confirm positive detection triggers law splitter

### Test 2: Recursive Splitter on No Markers
- Input: Plain text "Hello world, no legal structure here."
- Verifies: `factory.forDoc()` returns instance of `RecursiveSplitter`
- Purpose: Ensure non-legal documents default to recursive splitter

### Test 3: Recursive Splitter on Insufficient Markers
- Input: Document with only "Điều 1. Standalone."
- Verifies: `factory.forDoc()` returns instance of `RecursiveSplitter`
- Purpose: Validate threshold (requires ≥ 2) prevents false positives

### Helper Function
```typescript
const asDoc = (content: string): RawDoc => ({
  content,
  metadata: { sourceType: 'txt', title: 'x.txt' },
});
```
Converts plain strings to `RawDoc` objects for test input.

---

## 5. Design Notes & Concerns

### Threshold Justification
- **Why ≥ 2 threshold?** Single `Điều` marker could appear in any Vietnamese document by coincidence. Two or more markers form a strong signal of actual legal structure
- **Colon or Period:** Pattern allows both `Điều 1.` and `Điều 1:` to support varying source formats
- **No False Positives:** Documents with coincidental single "Điều N." string will route safely to `RecursiveSplitter`

### Regex Correctness
- **Multiline mode:** Ensures `^` matches at line boundaries, not just document start, important for documents with multiple articles
- **Whitespace flexibility:** `\s+` allows one or more spaces between "Điều" and the number, supporting inconsistent formatting
- **Digit capture:** `\d+` accepts any number of digits (1, 10, 100, etc.) without imposing artificial limits
- **Terminator alternatives:** `[.:]` covers both typical Vietnamese legal formatting conventions

### Performance Considerations
- **Single regex pass:** One `match()` call per document — O(n) scan is acceptable for document preprocessing
- **Lazy instantiation:** Factory creates splitter instances only when needed (not cached or pre-computed)
- **Memory:** No state is maintained; factory is stateless and reusable

### Robustness
- **Null-safe matching:** Regex `match()` returns null if no matches; check `matches && matches.length >= 2` safely handles both cases
- **Empty documents:** `null.length` would throw; code correctly guards with `matches &&` first
- **Non-ASCII content:** Vietnamese characters are handled natively in UTF-8 source files

---

## 6. Notes / Tech Debt

### None Identified

The implementation is minimal, focused, and matches the specification exactly. All tests pass, typecheck is clean, and the pattern matching is robust. No regressions or edge cases were encountered during TDD validation.

### Future Enhancement Opportunities

1. **Pluggable Patterns:** Allow constructor to accept custom detection patterns for different document types (e.g., English legal docs, contracts, etc.)
2. **Scoring System:** Instead of binary (2+ vs <2), use a scoring approach that weights document characteristics and returns confidence percentages
3. **Content Hints:** Accept optional metadata hints from loader (e.g., filename, MIME type, explicit classification) to improve accuracy
4. **Extensible Registry:** Support registering custom splitter types and detection rules at runtime for plugin architecture

