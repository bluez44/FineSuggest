# Plan 2 Task 3 Review: TextLoader (TDD)

**Date:** 2026-07-06  
**Task:** Plan 2 Task 3 — TextLoader implementation via test-driven development  
**Status:** COMPLETE

## Task

Implement `TextLoader`, a concrete `DocumentLoader` strategy that loads UTF-8 text and markdown files from buffers, normalizes whitespace, and optionally strips markdown syntax. Implemented using TDD: write failing tests → implement → pass tests.

## What Changed

Created 3 new files and 2 test fixtures:

- **`src/lib/ingestion/loaders/TextLoader.ts`** — Main implementation
  - Exports `TextLoader` class implementing `DocumentLoader` interface
  - Accepts buffer-only input (throws for URL kind)
  - Detects source type (`txt` or `md`) from filename/mimeType
  - Normalizes CRLF → LF and collapses 3+ blank lines to 2
  - Strips markdown syntax (headings, bold, italic, lists, links, code) for `.md` files
  - Returns `RawDoc` with normalized content and metadata

- **`test/unit/lib/ingestion/loaders/TextLoader.test.ts`** — 4 test cases
  - Test 1: Loads plain text with correct sourceType='txt'
  - Test 2: Loads markdown with sourceType='md' and strips syntax
  - Test 3: Normalizes CRLF and collapses blank lines
  - Test 4: Throws error for unsupported URL input

- **`test/fixtures/sample-plain.txt`** — Vietnamese legal text fixture
- **`test/fixtures/sample-law.md`** — Vietnamese legal text fixture with markdown

## How to Verify

1. **Red phase output** (before implementation):
   ```
   Test Files  1 failed (1)
   Error: Failed to resolve import "@/lib/ingestion/loaders/TextLoader"
   ```

2. **Green phase output** (after implementation):
   ```
   Test Files  1 passed (1)
   Tests  4 passed (4)
   ```

3. **Typecheck passes:**
   ```bash
   npm run typecheck
   ```
   Expected: clean exit with 0 errors

## Deviations

None. Implementation follows brief exactly, including:
- TDD sequence (RED → implementation → GREEN) executed as specified
- All 4 test cases pass without modification
- Markdown stripping regex patterns match brief verbatim
- Error handling for non-buffer input working correctly

## Notes / Tech Debt

- **Markdown stripping is minimal:** The `stripMarkdown` function handles common patterns (headings, bold, italic, lists, links, inline code) but not nested markdown, escaped characters, or complex link syntax. Sufficient for legal document content but may need enhancement for richer markdown inputs.

- **Path alias:** Uses `@/lib/ingestion/loaders/TextLoader` which resolves via Vitest path alias configuration pointing to `src/`.

- **Fixture directory created fresh:** `test/fixtures/` created as part of this task; fixtures use UTF-8 encoding with Vietnamese text to match real domain content.

---

Generated with Claude Code.
