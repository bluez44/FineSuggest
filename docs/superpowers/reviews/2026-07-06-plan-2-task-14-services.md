# Task 14 Review: DocumentService + QuotaService

## 1. Test Implementation

Three unit tests for QuotaService (per TDD brief):

- **Test 1: Allow upload under both limits** — Validates that an upload with file size 5 MB and current file count 3 succeeds (`{ ok: true }`).
- **Test 2: Reject oversized file** — Ensures files exceeding `MAX_FILE_SIZE_MB` (20 MB) are rejected with a reason containing "20 MB".
- **Test 3: Reject at quota limit** — Verifies rejection when user has already reached `MAX_FILES_PER_USER` (10) documents.

All tests use a fake Supabase client that returns configurable document counts.

**Test Status:** 3/3 PASS

## 2. QuotaService Implementation

Exports:
- `MAX_FILE_SIZE_MB = 20` — Max single file size in megabytes
- `MAX_FILES_PER_USER = 10` — Max documents per user
- `QuotaResult` type union for success/failure responses
- `QuotaService` class with `canUpload(userId, fileSizeBytes)` method

Logic:
1. Checks file size against `MAX_FILE_SIZE_MB`; if exceeded, returns `{ ok: false, reason: "File vượt 20 MB" }`
2. Queries `documents` table for `owner_id` count
3. If count >= `MAX_FILES_PER_USER`, returns quota exceeded error
4. Otherwise returns `{ ok: true }`

All error messages are Vietnamese as per project conventions.

## 3. DocumentService Implementation

Exports:
- `UploadFileInput` interface — File metadata, buffer, title, source type
- `UploadUrlInput` interface — URL, userId, title
- `DocumentService` class with four public methods

Methods:
- **uploadFile()** — Generates document UUID, uploads file to storage bucket under `{userId}/{documentId}{ext}`, inserts metadata row, cleans up storage on DB failure
- **uploadUrl()** — Creates document record with source_url instead of storage_path
- **list()** — Queries documents owned by user or marked public, ordered by creation date descending
- **delete()** — Fetches document to verify ownership via RLS, deletes DB row, removes storage file (if exists)

Full behavior covered by Task 22 integration tests.

## 4. Test Results

**QuotaService unit tests:**
```
Test Files  1 passed (1)
Tests  3 passed (3)
```

**Full test suite (all tasks 1-14):**
```
Test Files  14 passed (14)
Tests  51 passed (51)
```

**TypeScript:**
```
npm run typecheck → 0 (no errors)
```

## 5. Files Created

- `test/unit/lib/services/QuotaService.test.ts` (45 lines)
- `src/lib/services/QuotaService.ts` (25 lines)
- `src/lib/services/DocumentService.ts` (99 lines)

Both services follow DI pattern with user-scoped `SupabaseClient<Database>`.
