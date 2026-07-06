# Review: Plan 2 Task 06 — UrlLoader

**Date:** 2026-07-06
**Author:** Claude (claude-haiku-4-5)
**Task:** Implement UrlLoader with TDD using jsdom and @mozilla/readability

---

## 1. Summary

Implemented `UrlLoader` — a class that fetches HTML from URLs, parses with JSDOM, extracts article content via Mozilla's Readability algorithm, and returns a `RawDoc` with cleaned text and metadata. TDD was followed: tests were written and confirmed RED before the implementation was written, then confirmed GREEN after.

---

## 2. TDD Evidence

**RED output** (before implementation):
```
FAIL  test/unit/lib/ingestion/loaders/UrlLoader.test.ts
Error: Failed to resolve import "@/lib/ingestion/loaders/UrlLoader"
Test Files  1 failed (1)
Tests  no tests
```

**GREEN output** (after implementation):
```
Test Files  1 passed (1)
     Tests  3 passed (3)
  Duration  1.71s
```

All 3 tests passing:
1. `fetches URL, extracts article text, and stores URL in metadata`
2. `throws on non-2xx response`
3. `throws on kind=buffer input`

---

## 3. Implementation Strategy

### UrlLoader Class
- **Location:** `src/lib/ingestion/loaders/UrlLoader.ts`
- **Pattern:** Implements `DocumentLoader` interface (Task 2)
- **Accepts:** `LoaderInput` with `kind: 'url'` only; rejects `kind: 'buffer'` via `IngestionError`
- **Returns:** `RawDoc` with normalized content and metadata including `sourceUrl`

### Key Operations
1. **Input Validation:** Validates `input.kind === 'url'`; throws otherwise
2. **URL Fetching:** Uses injected `fetcher` (for tests) or global `fetch` with:
   - `redirect: 'follow'` for redirect handling
   - `user-agent: 'FineSuggest/1.0'` header
3. **HTML Parsing:** JSDOM parses HTML with `url` context for relative link resolution
4. **Article Extraction:** Mozilla Readability extracts the main article content
5. **Content Normalization:**
   - Removes trailing spaces before newlines (`\s+\n` → `\n`)
   - Collapses 3+ consecutive newlines to 2 (`\n{3,}` → `\n\n`)
   - Trims leading/trailing whitespace
6. **Error Handling:** Wraps HTTP errors and fetch failures in `IngestionError` with context

---

## 4. Test Coverage & Design

### Test 1: Article Extraction with Metadata
- Uses mock HTML with `<nav>`, `<article>`, `<footer>` structure
- Verifies:
  - `metadata.sourceType: 'url'`
  - `metadata.title: 'Nghị định 100/2019'` (from `<title>` or article)
  - `metadata.sourceUrl: 'https://example.com/nghi-dinh'`
  - Content includes article text (Điều 5, Điều 6)
  - Navigation/footer text excluded (readability strips boilerplate)

### Test 2: HTTP Error Handling
- Mock fetcher returns `ok: false, status: 404`
- Verifies error thrown with `404` in message

### Test 3: Input Kind Validation
- Mock loader receives `kind: 'buffer'` input
- Verifies error thrown with `UrlLoader` in message

**Dependency Injection:** `fetcher` parameter enables test mocking without global `fetch` pollution.

---

## 5. Design Notes & Concerns

- **Readability algorithm:** Mozilla's Readability is battle-tested on real-world news/article sites. Vietnamese text with diacritics is handled correctly (Readability operates on DOM nodes, preserving Unicode).
- **JSDOM initialization:** The `url` option is passed to JSDOM constructor so relative URLs in fetched content resolve correctly (though not used in current test).
- **Article extraction fallback:** If Readability fails to extract (`!article?.textContent`), an `IngestionError` is thrown with descriptive message.
- **Whitespace normalization:** The regex sequence first removes trailing spaces before newlines, then collapses excessive newlines — order matters for cleanliness.
- **User-Agent header:** Included to avoid 403 rejection by some sites; value is minimal per good HTTP citizenship.
- **Global fetch fallback:** `const fetcher = this.opts.fetcher ?? fetch` uses global when no test fetcher is provided — production behavior is standard Node fetch.
