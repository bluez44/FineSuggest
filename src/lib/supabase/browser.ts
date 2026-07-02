import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';
import type { Database } from '@/types/database';

export function createBrowserClient() {
  return createSupabaseBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
