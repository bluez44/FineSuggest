# Plan 2 Task 18: Document list components

**Status:** ✅ DONE

## Summary

Implemented three new React client components for displaying and managing documents with real-time status polling:
- `StatusBadge.tsx`: Renders status badges (pending, processing, ready, failed) with localized Vietnamese labels
- `DocumentCard.tsx`: Displays individual document card with metadata, source type icon, and delete button
- `DocumentList.tsx`: Client component that fetches `/api/documents`, polls every 3s while docs are in-flight, and manages deletion

Installed shadcn `badge` and `card` components via `npx shadcn@latest add badge card`.

## Verification

- ✅ TypeScript: 0 errors (npm run typecheck)
- ✅ Build: successful (npm run build)
- ✅ Tests: 51 passed, 14 test files passed (npm test -- --run)
- ✅ No regressions from previous tasks

## Components

### StatusBadge.tsx
Maps document status to Vietnamese labels and badge variants:
- pending → "Đang chờ" (outline)
- processing → "Đang xử lý" (secondary)
- ready → "Sẵn sàng" (default)
- failed → "Thất bại" (destructive)

### DocumentCard.tsx
Displays document information with:
- Source type icon (Globe for URL, FileText for others)
- Title and status badge
- Metadata: source type and visibility (Chung/Riêng)
- Delete button (only for private documents)
- Error message display for failed documents

### DocumentList.tsx
Client component with polling logic:
- Initial fetch on mount
- Continues polling every 3s while any document has status 'pending' or 'processing'
- Stops polling once all documents are 'ready' or 'failed'
- Supports external refresh via `refreshKey` prop
- Shows skeletons during initial load, empty state message when no documents
- Handles DELETE requests with optimistic UI update

## Files Added
- src/components/ui/badge.tsx (shadcn)
- src/components/ui/card.tsx (shadcn)
- src/components/documents/StatusBadge.tsx
- src/components/documents/DocumentCard.tsx
- src/components/documents/DocumentList.tsx

## Dependencies

Uses existing packages:
- React (useState, useEffect, useRef)
- shadcn/ui (Badge, Card, Button, Skeleton)
- lucide-react (FileText, Globe, Trash2)

No new external dependencies added.
