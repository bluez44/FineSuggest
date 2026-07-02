import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/requireUser';
import { createServerClient } from '@/lib/supabase/server';
import { isAllowlistedAdmin } from '@/lib/auth/admin-allowlist';
import { serverEnv } from '@/lib/env';
import { AppShell } from '@/components/shared/AppShell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const showAdmin =
    profile?.role === 'admin' ||
    isAllowlistedAdmin(user.email ?? '', serverEnv.ADMIN_EMAILS);

  return (
    <AppShell email={user.email ?? ''} showAdmin={showAdmin}>
      {children}
    </AppShell>
  );
}
