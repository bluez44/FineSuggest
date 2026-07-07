# Task 21 — Configure Supabase DB Webhook (deferred)

- **Plan:** [Plan 2 — Ingestion](../plans/2026-07-06-plan-2-ingestion.md)
- **Task:** 21 (manual configuration)
- **Date:** 2026-07-06
- **Status:** Deferred to Plan 4 (deploy phase)

## What changed

Nothing in the repo. Task 21 is external Supabase Dashboard configuration.

## Rationale for deferral

The webhook needs a **publicly reachable HTTPS URL** for Supabase Cloud to POST to. In local dev this requires a tunnel (ngrok or cloudflared). Since deploy to Vercel is planned for Plan 4, the production URL (`https://<app>.vercel.app/api/ingest/process`) will be available then — no tunnel needed at that point.

Rather than set up a temporary tunnel for local dev and re-register the webhook again after deploy, we register once against the production URL during Plan 4.

## Impact on Plan 2 completion

- **Upload UI works** (Tasks 15, 18-20): user can upload files, rows persist with `status='pending'`.
- **Pipeline works** (Tasks 2-13): verified by Task 22's integration test which invokes the pipeline directly with a service-role client, bypassing the HTTP webhook.
- **Documents kept in `pending`** in local dev until the webhook or a manual trigger fires the worker route. This is expected and does not block Plan 3 (chat/RAG) development, which reads from `chunks` seeded by Task 22 or admin uploads.

## How to verify (once resumed)

Instructions carry over verbatim to Plan 4:

1. Supabase Dashboard → Database → Webhooks → Create hook
2. Table: `documents`, Events: Insert, Method: POST
3. URL: `https://<production-domain>/api/ingest/process`
4. Header: `Authorization: Bearer <INGEST_WEBHOOK_SECRET>`
5. Upload a fixture and confirm status transitions `pending → processing → ready`.

## Notes / tech debt

- **Alternative for early local testing:** call `POST /api/ingest/process` manually via curl/Postman with the same bearer secret and a synthetic payload. Not automated but sufficient for smoke tests.
- **Local dev with real webhook (if needed later):** tunnel setup (ngrok / cloudflared) is documented in the plan file itself.
