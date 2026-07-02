'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createBrowserClient } from '@/lib/supabase/browser';

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      console.error('Sign-in error', error);
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleSignIn} disabled={loading} size="lg" className="w-full">
      {loading ? 'Đang chuyển hướng...' : 'Đăng nhập với Google'}
    </Button>
  );
}
