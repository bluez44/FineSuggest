# Review: Plan 2 Task 04 — PdfLoader

**Date:** 2026-07-06
**Author:** Claude (claude-sonnet-4-6)
**Task:** Implement PdfLoader with TDD using pdfjs-dist and pageMap tracking

---

## 1. Summary

Implemented `PdfLoader` — a class that extracts text from PDF buffers using `pdfjs-dist` v6 and returns a `RawDoc` with per-page `pageMap` offsets. TDD was followed: tests were written and confirmed RED before the implementation was written, then confirmed GREEN after.

---

## 2. TDD Evidence

**RED output** (before implementation):
```
FAIL  test/unit/lib/ingestion/loaders/PdfLoader.test.ts
Error: Failed to resolve import "@/lib/ingestion/loaders/PdfLoader" from "..."
Test Files  1 failed (1)
Tests  no tests
```

**GREEN output** (after implementation):
```
Test Files  1 passed (1)
     Tests  3 passed (3)
  Duration  3.48s
```

All 3 tests passing:
1. `extracts text from a 2-page PDF and reports 2 page entries`
2. `pageMap start/end offsets bracket each page in content`
3. `throws on non-PDF buffer`

---

## 3. pdfjs-dist Import Path

The `.mjs` path worked on the first attempt:

```typescript
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
```

Used as: `pdfjs.getDocument(...)` — the named export was available directly from the default module namespace. No fallback to `.js` (CommonJS) was needed. The import is dynamic so it is deferred until `PdfLoader.load()` is called.

---

## 4. PDF Fixture Generation

Installed `pdf-lib` as a dev dependency (`npm install -D pdf-lib`) and used it to generate `test/fixtures/sample.pdf`. The fixture is a 2-page PDF with ASCII text:
- Page 1: `Article one. Page one text.`
- Page 2: `Article two. Page two text.`

File size: 1096 bytes (well above the 500-byte minimum). The brief's hand-rolled PDF option was skipped in favor of `pdf-lib` as instructed, since the hand-rolled version is unreliable for text extraction.

---

## 5. Design Notes & Concerns

- **pageMap cursor arithmetic:** The `cursor` variable is advanced by `pageText.length + 2` after each page to account for the `\n\n` joiner used in `parts.join('\n\n')`. This ensures `pageMap[i].start` and `pageMap[i].end` correctly bracket each page's text within the final `content` string.
- **`any` cast on textContent items:** `pdfjs-dist` v6 types expose `TextItem | TextMarkedContent` and only `TextItem` has `.str`. The `any` cast with the `'str' in item` guard is a pragmatic solution; strict typing could use `import type { TextItem }` from pdfjs-dist types.
- **jsdom test environment:** Tests run in jsdom (per vitest config). pdfjs-dist legacy build works fine in this environment for Node-side parsing.
- **No worker thread:** `pdfjs-dist` in Node doesn't require a worker; the `disableFontFace: true` and `useSystemFonts: false` options ensure clean server-side extraction without browser APIs.
