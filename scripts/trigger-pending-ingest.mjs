#!/usr/bin/env node
// Local-dev helper. Finds all documents with status='pending' and posts each
// one to /api/ingest/process (the same payload the Supabase DB Webhook would
// send in production). Use this after uploading a file via /documents while
// the DB Webhook is not yet configured (Task 21 — deferred to Plan 4 deploy).
//
// Usage (from D:\FineSuggest):
//   set -a && source .env.local && set +a && node scripts/trigger-pending-ingest.mjs
//
// Optional env: APP_URL (defaults to http://localhost:3000).

import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET =
  process.env.INGEST_WEBHOOK_SECRET;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPA_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  INGEST_WEBHOOK_SECRET: SECRET,
})) {
  if (!value) {
    console.error(
      `Missing env: ${name}. Did you run 'set -a && source .env.local && set +a' before invoking?`,
    );
    process.exit(1);
  }
}

const admin = createClient(SUPA_URL, SERVICE_KEY);

const { data: pending, error } = await admin
  .from('documents')
  .select('id, owner_id, source_type, storage_path, source_url, title, status')
  .eq('status', 'pending')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Failed to list pending documents:', error.message);
  process.exit(1);
}

if (!pending || pending.length === 0) {
  console.log('No pending documents. Nothing to trigger.');
  process.exit(0);
}

console.log(`Found ${pending.length} pending document(s). Triggering /api/ingest/process ...`);

for (const doc of pending) {
  console.log(`\n→ ${doc.id} (${doc.source_type}) ${doc.title}`);
  const res = await fetch(`${APP_URL}/api/ingest/process`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      type: 'INSERT',
      table: 'documents',
      record: {
        id: doc.id,
        owner_id: doc.owner_id,
        source_type: doc.source_type,
        storage_path: doc.storage_path,
        source_url: doc.source_url,
        status: 'pending',
      },
    }),
  }).catch((err) => {
    console.error(`  fetch failed: ${err.message}`);
    return null;
  });
  if (!res) continue;
  const text = await res.text();
  console.log(`  status ${res.status}: ${text.slice(0, 200)}`);
}

console.log('\nDone. Refresh /documents to see status transitions.');
