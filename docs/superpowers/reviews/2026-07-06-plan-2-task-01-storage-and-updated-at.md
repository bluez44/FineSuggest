# Task 1 — Storage bucket + `documents.updated_at` trigger

- **Plan:** [Plan 2 — Ingestion](../plans/2026-07-06-plan-2-ingestion.md)
- **Task:** 1 (storage bucket + document updated_at column with trigger)
- **Date:** 2026-07-06

## What changed

Migration `0007_storage_and_document_updated_at.sql` created:

1. **Storage bucket `documents`** (private, 20 MB file size limit, 4 MIME types):
   - `application/pdf`
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
   - `text/plain`
   - `text/markdown`

2. **RLS policies on `storage.objects`** (3 policies):
   - `documents owner insert`: restrict to owner's user ID folder prefix
   - `documents owner select`: restrict to owner's user ID folder prefix
   - `documents owner delete`: restrict to owner's user ID folder prefix

3. **`documents.updated_at` column** (timestamptz, default now()):
   - `set_updated_at()` trigger function automatically updates to `now()` on every UPDATE
   - Enables client polling to detect status changes without diffing the full row

**Files:**
- Created: `supabase/migrations/0007_storage_and_document_updated_at.sql`
- Modified: `src/types/database.ts` (hand-edited to add `updated_at` field to `documents` Row/Insert/Update)

## How to verify

```bash
# 1. Migration file exists
ls -la supabase/migrations/0007_storage_and_document_updated_at.sql

# 2. Types compile
npm run typecheck    # Expected: 0 errors

# 3. Cloud verification (requires manual dashboard check):
#    - Supabase Dashboard → Storage → confirm bucket 'documents' exists
#    - Supabase Dashboard → Storage → bucket → confirm 20 MB limit + 4 MIME types
#    - Supabase Dashboard → Table Editor → documents → columns → confirm 'updated_at' present
```

Typecheck output:
```
> finesuggest@0.1.0 typecheck
> tsc --noEmit
(no errors)
```

## Deviations from plan

**Major deviation:** Migration not yet applied to Supabase Cloud database.

**Reason:** Network/DNS resolution failure when attempting `supabase db push --db-url "$SUPABASE_DB_URL"`:
- Attempted pooler URLs: `aws-0-us-east-1.pooler.supabase.com` (host resolution fails)
- Alternative formats: `xybjldnhlpnkmlkijcfk.pooler.supabase.com`, direct DB hosts all failed DNS lookup
- `psql` not available on this system; no Docker/podman for `supabase gen types`

**Workaround applied:** Used the explicit fallback path from the task brief:
- Created migration SQL file (exact text from brief, verbatim)
- Hand-edited `src/types/database.ts` to add `updated_at: string;` to Row and `updated_at?: string;` to Insert/Update for `documents` table
- Verified types compile (`npm run typecheck` → 0 errors)

**Next steps to fully complete this task:**
1. Obtain a working SUPABASE_DB_URL (correct region/region code for project `xybjldnhlpnkmlkijcfk`)
2. Run `supabase db push --db-url "$SUPABASE_DB_URL"` to apply migration to cloud
3. Verify bucket + column in Dashboard (step 4 of task brief)

The SQL migration and type signatures are correct and ready to push; only the network connectivity prevented the final `db push` step.

## Notes / tech debt

- **Storage bucket policies use `(storage.foldername(name))[1]` to extract user folder.** This assumes files are stored as `{userId}/{filename}`. The application code (Plan 2 later tasks) must enforce this naming when uploading.
- **`updated_at` trigger will fire on any UPDATE to documents row**, even if no actual data changes. This is acceptable for now; if performance becomes a concern, add a check to only update if other columns changed.
- **Plan 1 handoff note recorded:** migrations pushed via `supabase db push --db-url ...` because Docker/podman unavailable. Same constraint affects this task. Once the correct pooler URL is obtained (or Docker is installed), the migration can be pushed immediately with the SQL file already in version control.
- **No migration history table created.** Supabase auto-manages this in `_supabase_migrations` table; `db push` uses it to track applied migrations.
