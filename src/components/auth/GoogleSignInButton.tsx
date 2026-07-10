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
    <Button
      onClick={handleSignIn}
      disabled={loading}
      size="lg"
      className="w-full relative flex items-center justify-center gap-3 border border-white/10 hover:border-white/20 bg-white/5 text-foreground hover:bg-white/10 h-12 rounded-xl transition-all shadow-md active:scale-[0.98]"
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <g transform="matrix(1, 0, 0, 1, 0, 0)">
            <path
              d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.6h3.29c1.92,-1.78 3.02,-4.4 3.02,-7.4c0,-0.74 -0.07,-1.4 -0.2,-2H21.35z"
              fill="#4285F4"
            />
            <path
              d="M12,20.6c2.43,0 4.47,-0.8 5.96,-2.2l-2.92,-2.26c-0.8,0.54 -1.84,0.86 -3.04,0.86c-2.34,0 -4.32,-1.58 -5.03,-3.7H3.6v2.3C5.08,18.57 8.32,20.6 12,20.6z"
              fill="#34A853"
            />
            <path
              d="M6.97,13.3c-0.18,-0.54 -0.28,-1.12 -0.28,-1.7c0,-0.58 0.1,-1.16 0.28,-1.7V7.6H3.6C3,8.8 2.66,10.17 2.66,11.6c0,1.43 0.34,2.8 0.94,4l2.77,-2.1c-0.18,-0.5 -0.4,-1.1 -0.4,-1.7z"
              fill="#FBBC05"
            />
            <path
              d="M12,5.4c1.32,0 2.5,0.46 3.44,1.36l2.58,-2.58C16.46,2.78 14.43,2 12,2C8.32,2 5.08,4.03 3.6,7.6l3.37,2.6c0.71,-2.12 2.69,-3.8 5.03,-3.8z"
              fill="#EA4335"
            />
          </g>
        </svg>
      )}
      <span>{loading ? 'Đang chuyển hướng...' : 'Đăng nhập bằng Google'}</span>
    </Button>
  );
}
