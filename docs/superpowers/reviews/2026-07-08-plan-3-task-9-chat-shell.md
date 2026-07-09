# Review: Plan 3 Task 9 — ChatShell with Composer + MessageList

**Date:** 2026-07-08  
**Reviewer:** Claude (task implementation self-review)  
**Files created:**
- `src/components/chat/Composer.tsx`
- `src/components/chat/MessageList.tsx`
- `src/components/chat/ChatShell.tsx`

---

## Summary

Task 9 delivers the main chat surface: a `Composer` input form, a `MessageList` scroll container, and `ChatShell` that wires them together via `useChat` from `@ai-sdk/react` v4.0.19.

---

## Casts and Workarounds

### 1. `transport as never` in `useChat` call (`ChatShell.tsx`)

```tsx
transport: transport as never,
```

**Why:** `DefaultChatTransport` is exported from the `ai` package (v7). The `useChat` hook from `@ai-sdk/react` v4 expects a `ChatTransport<UI_MESSAGE>` where `UI_MESSAGE` is constrained by the hook's own internal generic. At the call site, TypeScript cannot resolve that `DefaultChatTransport<UIMessage>` satisfies the `ChatTransport<UIMessage>` constraint as seen by `@ai-sdk/react`'s types, due to cross-package generic variance. Pre-authorized by the task brief.

### 2. `(part as any).type` and `(part as any).data` in `onData` callback (`ChatShell.tsx`)

```tsx
if ((part as any).type === 'data-citations') {
  ...
  (part as any).data as Citation[]
}
```

**Why:** The `onData` callback is typed as `ChatOnDataCallback<UI_MESSAGE>` which receives `DataUIPart<InferUIMessageData<UIMessage>>`. Since `UIMessage` is used without the `DATA_PARTS` generic argument (plain `UIMessage` defaults to `UIDataTypes` which is a generic record type), TypeScript cannot narrow the discriminated union to `data-citations`. Casting via `as any` is the correct minimal fix — pre-authorized by the task brief.

### 3. `handleKeyDown` cast (`Composer.tsx`)

```tsx
handleSubmit(e as unknown as FormEvent);
```

**Why:** The `handleSubmit` function expects a `FormEvent`, but the `onKeyDown` handler receives a `KeyboardEvent<HTMLTextAreaElement>`. Since `handleSubmit` only calls `e.preventDefault()`, the cast is safe — both event types share that method.

---

## Implementation Notes

- **Composer**: Enter-submits with Shift+Enter for newline. Vietnamese placeholder "Hỏi về luật giao thông…" and button label "Gửi". Shows `Còn X câu hôm nay` when `remaining` is provided, otherwise shows char count `N/2000`.
- **MessageList**: `whitespace-pre-wrap` on the scroll container. Auto-scrolls to bottom on `messages` change via `useEffect`. Empty-state copy in Vietnamese.
- **ChatShell**: `DefaultChatTransport` created in `useMemo` keyed on `conversationId` so it re-creates only when the conversation changes. Citations tracked in local state, updated via `onData`. Composer is disabled while `status` is `'streaming'` or `'submitted'`.

---

## Typecheck + Test Results

- `npx tsc --noEmit`: **clean** (no errors)
- `npx vitest run`: **82 passed | 1 skipped** (unchanged from pre-task baseline)
