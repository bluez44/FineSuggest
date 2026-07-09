# Review: Plan 3 Task 8 — Citation UI Components

**Date:** 2026-07-08
**Reviewer:** automated post-implementation review
**Status:** PASSED

## Summary

Task 8 installed `@ai-sdk/react` (v4.0.19 ≥ 4.0.0 required) and created three client components for the chat citation UI layer.

## Files Changed

- `package.json` / `package-lock.json` — added `@ai-sdk/react@4.0.19`
- `src/components/chat/CitationPreviewModal.tsx` — Dialog-based snippet preview
- `src/components/chat/CitationPill.tsx` — pill button for a single citation
- `src/components/chat/MessageBubble.tsx` — message bubble with inline marker highlighting and citation pill row

## Implementation Notes

1. **Dialog API** — project uses shadcn/ui dialog from `radix-ui`. `DialogDescription` and `DialogFooter` are exported from `src/components/ui/dialog.tsx`; brief usage matches project API exactly.
2. **No markdown / dangerouslySetInnerHTML** — text rendered via `whitespace-pre-wrap` and a `split(MARKER_RE)` approach that wraps `[n]` markers in amber `<span>` elements; plain text segments use `<Fragment>`.
3. **UIMessage type** — imported from `ai` (not `@ai-sdk/react`); `m.parts` filtered to `type === 'text'` segments joined to produce display text.
4. **Vietnamese copy** — "Trích dẫn nguồn", "Đóng", "Nguồn" used throughout.
5. **MARKER_RE reset** — regex literal with `/g` flag is module-scoped; `MARKER_RE.test()` advances `lastIndex`, but because `split()` runs first the segments are already split before `.test()` is called in the map, so lastIndex advances correctly per segment. No stateful bug introduced.

## Typecheck

`npx tsc --noEmit` — clean, no errors.

## Test Suite

`npx vitest run` — 82 passed, 1 skipped (unchanged from pre-task baseline).

## No Issues Found
