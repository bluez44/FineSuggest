# Review: Plan 2 Task 07 — LoaderFactory

**Date:** 2026-07-06
**Author:** Claude (claude-haiku-4-5)
**Task:** Implement LoaderFactory with file-type MIME sniffing (TDD)

---

## 1. Summary

Implemented `LoaderFactory` — a class that routes documents to the appropriate loader (TextLoader, PdfLoader, DocxLoader, UrlLoader) based on input kind, magic-byte MIME sniffing via `file-type`, and filename extensions. TDD was followed: 6 tests were written first and confirmed RED before the implementation, then confirmed GREEN after.

---

## 2. TDD Evidence

**RED output** (before implementation):
```
FAIL  test/unit/lib/ingestion/loaders/LoaderFactory.test.ts
Error: Failed to resolve import "@/lib/ingestion/loaders/LoaderFactory"
Test Files  1 failed (1)
Tests  no tests
```

**GREEN output** (after implementation):
```
Test Files  1 passed (1)
     Tests  6 passed (6)
  Duration  2.20s
```

All 6 tests passing:
1. `routes URL input to UrlLoader`
2. `sniffs PDF magic bytes and routes to PdfLoader`
3. `sniffs DOCX magic bytes and routes to DocxLoader`
4. `routes text/plain buffer to TextLoader`
5. `routes .md filename to TextLoader even if MIME is text/plain`
6. `throws for unsupported MIME on buffer`

---

## 3. Implementation Strategy

### LoaderFactory Class
- **Location:** `src/lib/ingestion/loaders/LoaderFactory.ts`
- **Pattern:** Factory pattern dispatching to concrete loaders
- **Method:** `async forInput(input: LoaderInput): Promise<DocumentLoader>`
- **Accepts:** `LoaderInput` with `kind: 'url'` or `kind: 'buffer'`
- **Returns:** Appropriate DocumentLoader instance

### Routing Logic
1. **URL Routing:** If `input.kind === 'url'`, return `new UrlLoader()` immediately (no async magic needed)
2. **Markdown Extension Override:** If filename ends with `.md` (case-insensitive), return `new TextLoader()` (because file-type cannot reliably detect .md as markdown — it appears as plain text)
3. **Magic Byte Sniffing:** 
   - Call `fileTypeFromBuffer(new Uint8Array(input.buffer))` to detect actual MIME type from file magic bytes
   - Fall back to caller-provided `input.mimeType` if sniffing yields no result
4. **MIME-Based Dispatch:**
   - PDF (`application/pdf`) → `PdfLoader`
   - DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) → `DocxLoader`
   - Text MIME (`text/plain` or any `text/*`) → `TextLoader`
   - Unsupported MIME → throw `IngestionError`

---

## 4. Test Coverage & Design

### Test 1: URL Input
- Input: `{ kind: 'url', url: 'https://x.example' }`
- Verifies: Returns `UrlLoader` instance
- Purpose: Ensure URL routing is synchronous path

### Test 2: PDF Magic Bytes
- Input: Real `sample.pdf` with unknown filename and octet-stream MIME
- Verifies: Magic byte sniffing returns `PdfLoader`
- Purpose: Ensure magic bytes override caller-provided MIME type

### Test 3: DOCX Magic Bytes
- Input: Real `sample.docx` with unknown filename and octet-stream MIME
- Verifies: Magic byte sniffing returns `DocxLoader`
- Purpose: Ensure DOCX detection via magic bytes works

### Test 4: Plain Text Buffer
- Input: `Buffer.from('hello')` with `.txt` filename and `text/plain` MIME
- Verifies: Returns `TextLoader`
- Purpose: Ensure text/plain routing works

### Test 5: Markdown Extension Override
- Input: `Buffer.from('# hello')` with `.md` filename and `text/plain` MIME
- Verifies: Returns `TextLoader` (extension takes precedence)
- Purpose: Ensure .md files are treated as text even if MIME is plain text

### Test 6: Unsupported MIME
- Input: Binary data with `x.exe` filename and octet-stream MIME
- Verifies: Throws `IngestionError` matching regex `/Unsupported/`
- Purpose: Ensure invalid formats are rejected cleanly

---

## 5. Design Notes & Concerns

- **Uint8Array Conversion:** The `file-type@^22` library expects `Uint8Array` or `ArrayBuffer`, not Node.js `Buffer`. Converting via `new Uint8Array(input.buffer)` is safe and idiomatic.
- **Markdown Detection:** file-type cannot distinguish `.md` from `.txt` at the byte level (both are UTF-8 text). Filename-based override (`endsWith('.md')`) is the correct approach.
- **Magic Byte Precedence:** Sniffed MIME takes precedence over caller's MIME type (`sniffed?.mime ?? input.mimeType`). This handles cases where the caller mistakenly reports `application/octet-stream` for a valid PDF/DOCX.
- **Error Granularity:** Unsupported MIME types throw `IngestionError` with `'load'` context, allowing callers to distinguish loading failures from other ingestion errors.
- **Async Signature:** The factory method is `async` to support future magic-byte detection upgrades or async loader initialization without breaking the API.
- **Case-Insensitive Extension Check:** `.md`, `.MD`, `.Md` all work via `toLowerCase()` before `endsWith()` comparison.

