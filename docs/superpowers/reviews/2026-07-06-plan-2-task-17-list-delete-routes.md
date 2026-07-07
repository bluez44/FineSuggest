# Review: GET /api/documents + DELETE /api/documents/[id] Routes (Task 17)

## 1. Implementation Summary

Extended document API with two new routes:
- **GET /api/documents**: Lists all documents for authenticated user
- **DELETE /api/documents/[id]**: Deletes document by ID with ownership validation
Both use existing `DocumentService` methods and require user authentication via `requireUser()`.

## 2. GET /api/documents Handler

Added to existing `src/app/api/documents/route.ts`:
- Authenticates user via `requireUser()`
- Creates Supabase client via `createServerClient()`
- Calls `DocumentService.list(user.id)` to fetch user's documents
- Returns JSON response: `{ documents: DocumentRow[] }`
- Inherits `runtime: 'nodejs'` from POST handler

## 3. DELETE /api/documents/[id] Handler

Created new `src/app/api/documents/[id]/route.ts`:
- Declares `runtime: 'nodejs'` for middleware compatibility
- Uses async params destructuring pattern: `params: Promise<{ id: string }>`
- Authenticates user, creates Supabase client
- Calls `DocumentService.delete(user.id, id)` with user context
- Implements error handling: catches exceptions and maps to HTTP status codes
  - 'Forbidden' → 403
  - 'Document not found' → 404
  - Other errors → 500
- Returns 204 No Content on success via `NextResponse(null, { status: 204 })`

## 4. Authentication & Authorization

- Both routes require `await requireUser()` to validate session
- DELETE passes `user.id` to service, ensuring users can only delete their own documents
- Service layer handles ownership validation; handler maps errors appropriately

## 5. Build & Test Verification

✓ Typecheck: 0 errors  
✓ Build: Both routes compiled (shown in manifest as `ƒ /api/documents` and `ƒ /api/documents/[id]`)  
✓ Test suite: 14 test files, 51 tests pass (no regressions)  

---
Implements verbatim from brief spec. Routes work with existing `DocumentService.list()` and `DocumentService.delete()` methods.
