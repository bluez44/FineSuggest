# Review: POST /api/documents Upload Route (Task 15)

## 1. Implementation Summary

Created `src/app/api/documents/route.ts` with a POST handler that:
- Accepts multipart file uploads or JSON URL submissions
- Performs MIME type sniffing via `file-type` library
- Enforces quota limits before file ingestion
- Returns `{ id }` on successful upload (HTTP 201)
- Handles validation, authentication, and error responses

## 2. Content Type Handling

The route branches on `content-type` header:
- **application/json**: URL submission path → `documents.uploadUrl()`
- **multipart/form-data**: File upload path → `documents.uploadFile()`
- Other types → 415 Unsupported Media Type

URL validation uses Zod schema requiring non-empty string URL and title (1-200 chars).
File uploads require both `file` and `title` form fields.

## 3. MIME Type Sniffing & Extension Handling

- Uses `fileTypeFromBuffer()` to detect actual MIME type
- Fallback to `file.type` if sniffing fails
- Special case: `.md` files detected as `text/plain` → override to `text/markdown`
- Maps MIME types to ingestion source types (pdf, docx, txt, md)
- Rejects unsupported types with 415 status

## 4. Quota & Permission Gates

- `requireUser()` validates authenticated user (Task 2)
- `QuotaService.canUpload()` checks file size against user quota
- Returns 413 Payload Too Large if quota exceeded
- `DocumentService` methods handle DB storage with user context

## 5. Build & Test Verification

✓ Typecheck: 0 errors
✓ Build: Route compiled into `.next/ssr` manifest as `ƒ /api/documents`
✓ Test suite: All 14 test files, 51 tests pass (no regressions)

---
Implements verbatim from brief spec. Runtime set to `nodejs` for pdfjs/mammoth/jsdom compatibility.
