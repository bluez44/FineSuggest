# Task 5 Review: DocxLoader (2026-07-06)

## Summary
Implemented `DocxLoader` with full TDD discipline. Class leverages `mammoth` to extract text from DOCX files with Vietnamese diacritical mark preservation.

## Implementation Details

### DocxLoader Class
- **Location:** `src/lib/ingestion/loaders/DocxLoader.ts`
- **Pattern:** Implements `DocumentLoader` interface (Task 2)
- **Accepts:** `LoaderInput` with `kind: 'buffer'` only
- **Returns:** `RawDoc` with normalized content and metadata

### Key Operations
1. **Input Validation:** Rejects non-buffer inputs via `IngestionError`
2. **DOCX Parsing:** Uses `mammoth.extractRawText()` for reliable text extraction
3. **Content Normalization:** 
   - Converts `\r\n` to `\n` for consistency
   - Collapses 3+ consecutive newlines to 2
   - Trims leading/trailing whitespace
4. **Error Handling:** Wraps mammoth exceptions in `IngestionError` with context

### Fixture Generation
- **File:** `test/fixtures/sample.docx`
- **Method:** Generated via `docx` package (installed as dev dependency)
- **Content:** Vietnamese text with diacritics (`Điều 1. Nội dung một.` and `Điều 2. Nội dung hai.`)

## Test Coverage

### Test 1: Vietnamese Diacritics Preservation
- Verifies text extraction preserves Vietnamese marks
- Asserts metadata fields (`sourceType: 'docx'`, `title: 'sample.docx'`)
- Validates both paragraphs extracted correctly

### Test 2: Invalid Input Handling
- Confirms error thrown on non-DOCX binary data
- Uses `Buffer.from('not a docx')` to simulate corruption

Both tests PASS consistently.

## Quality Checks
- **Typecheck:** 0 errors (TypeScript validation clean)
- **Test Status:** 2/2 PASS
- **Vietnamese Output:** Diacritics correctly preserved in test assertions

## Decisions
- Used `mammoth` (already installed) instead of alternative DOCX parsers
- Kept `docx` as dev dependency (fixture generation utility per Task 4 pattern)
- Simple normalization strategy balances readability and fidelity
