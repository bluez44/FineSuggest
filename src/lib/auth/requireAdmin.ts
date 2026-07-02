import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { isAllowlistedAdmin } from '@/lib/auth/admin-allowlist';
import { serverEnv } from '@/lib/env';

export async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // First check the profiles.role column (set by admin manually or via promote)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') {
    return user;
  }

  // Fallback: bootstrap from ADMIN_EMAILS env (promote on first sight)
  const email = user.email ?? '';
  if (isAllowlistedAdmin(email, serverEnv.ADMIN_EMAILS)) {
    // Promote via service role (RLS would block self-promotion)
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    );
    await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id);
    return user;
  }

  redirect('/');
}
