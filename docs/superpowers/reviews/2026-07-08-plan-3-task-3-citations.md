# Review: Task 3 — `parseCitations` (Plan 3, 2026-07-08)

## Summary

Implemented `parseCitations` — a pure function that scans LLM-generated text for `[n]` citation markers and produces structured `Citation[]` objects referencing retrieved chunks. The function handles marker deduplication (by first-appearance order), skips out-of-range markers silently, and truncates snippets to ≤300 chars at word boundaries.

## Implementation Details

- **Interfaces**:
  - `CitationSourceChunk`: Input shape with id, documentId, content, dieu, khoan, diem, page, documentTitle.
  - `Citation`: Output type adding markerIndex and truncated snippet.

- **Core Logic**:
  - Regex-based marker extraction (`/\[(\d+)\]/g`) in document order.
  - Deduplication via Set<number> tracking first appearances.
  - Array-index lookup: marker `[n]` → `retrieved[n-1]`.
  - Word-boundary truncation: find last space within 60-char tail tolerance, else use hard limit.

- **Edge Cases**:
  - Empty or no-marker text returns `[]`.
  - Out-of-range markers (e.g., `[99]` with 1 chunk) are skipped.
  - Repeated markers deduplicated to single entry.

## Test Coverage (6/6)

1. First-appearance order deduplication
2. Marker repetition handling
3. Out-of-range marker silencing
4. Snippet truncation (length and word boundary)
5. Empty result on no markers
6. Empty result on empty text

## Build Status

- TypeScript: Clean (--noEmit)
- Vitest: 66 passed, 1 skipped (full suite)
- Test file: 6/6 passing

## Files

- `src/lib/rag/citations.ts` — Implementation (CitationSourceChunk, Citation, parseCitations)
- `test/unit/lib/rag/citations.test.ts` — Test suite (6 cases, all passing)

## Notes

- Pure function, no I/O or side effects.
- Integrates seamlessly with Task 4's `RetrievedChunk` (extends CitationSourceChunk).
- Snippet truncation logic respects word boundaries to avoid breaking words mid-token.
