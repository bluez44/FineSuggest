# Plan 2 Task 19: UploadDialog component

**Status:** ✅ DONE

## Summary

Implemented `UploadDialog.tsx`, a client component for uploading documents via file or URL. Installed shadcn `tabs` and `label` components via `npx shadcn@latest add tabs label`.

The component provides:
- Modal dialog triggered by "Thêm tài liệu" button
- Two tabs: "Tệp" (file upload) and "URL" (web page ingestion)
- Form validation and loading states
- Toast notifications for user feedback

## Verification

- ✅ TypeScript: 0 errors (npm run typecheck)
- ✅ Build: successful (npm run build)
- ✅ Tests: 51 passed, 14 test files passed (npm test -- --run)
- ✅ No regressions from previous tasks

## Component

### UploadDialog.tsx

Client component with two submission handlers:

**File tab:**
- Accepts `.pdf`, `.docx`, `.txt`, `.md` files (max 20 MB)
- Optional title field (defaults to filename if empty)
- Sends FormData to `/api/documents` with file and title
- Toast error if no file selected

**URL tab:**
- Requires URL and title inputs
- Sends JSON to `/api/documents` with url and title fields
- Validates URL format via HTML5 input type

**Common behavior:**
- Sets `busy` state during submission to disable button
- Shows loading text during request
- Closes dialog and calls `onUploaded()` callback on success
- Displays error toast with server message or fallback text

## Files Added

- src/components/ui/tabs.tsx (shadcn)
- src/components/ui/label.tsx (shadcn)
- src/components/documents/UploadDialog.tsx

## Dependencies

Uses existing packages:
- React (useState, React.FormEvent)
- shadcn/ui (Dialog, Tabs, Button, Input, Label)
- sonner (toast notifications)
- lucide-react (Upload icon)

No new external dependencies added.
