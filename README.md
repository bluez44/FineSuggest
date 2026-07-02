# FineSuggest

Trợ lý AI hỏi đáp luật giao thông Việt Nam — chỉ trả lời dựa trên tài liệu, có trích dẫn điều/khoản rõ ràng.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase Cloud (Postgres + pgvector + Auth + Storage) · Gemini (chat + embeddings) · LangChain.js · Vercel AI SDK · Vitest · Playwright.

## Local setup

### Prerequisites

- Node.js 20+
- Supabase Cloud project (free tier) — see `docs/superpowers/plans/2026-06-30-plan-1-foundation.md` Task 19 for Google OAuth setup
- Google Cloud OAuth Client credentials

### Steps

```bash
git clone <repo>
cd FineSuggest

npm ci

# Copy env template and fill in keys
cp .env.example .env.local
# Fill in:
# - Supabase publishable + service_role keys (from Supabase Dashboard → Settings → API Keys)
# - ADMIN_EMAILS (your Google email, so requireAdmin will promote you)

# Push migrations to your Supabase project (one-time)
npx supabase db push --db-url 'postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres'

# Run dev server
npm run dev
```

Visit `http://localhost:3000`.

### Common commands

| Command | What |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | E2E tests (Playwright) |
| `npm run e2e -- --project=chromium` | E2E chromium only |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (CI) |
| `npm run types:db` | Regenerate `src/types/database.ts` (needs Docker or manual sync) |

## Project structure

See `docs/superpowers/specs/2026-06-30-traffic-law-rag-design.md` for full design.
See `docs/superpowers/plans/` for implementation plans (1 = foundation; later plans cover ingestion, RAG, hardening).

## Deployment

Not yet — Plan 4 handles production hardening + deployment to Vercel.
