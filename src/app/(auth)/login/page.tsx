import { redirect } from 'next/navigation';
import { getOptionalUser } from '@/lib/auth/requireUser';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Scale } from 'lucide-react';

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) {
    redirect('/chat');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-primary/10 blur-[90px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md glass-card rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 md:p-10 shadow-2xl backdrop-blur-xl">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Scale className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-gradient bg-gradient-to-r from-violet-400 to-cyan-300">FineSuggest</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Đăng nhập để đặt câu hỏi về luật giao thông đường bộ Việt Nam
            </p>
          </div>
        </div>

        <div className="mt-8">
          <GoogleSignInButton />
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground/60 border-t border-white/[0.06] pt-6">
          Ứng dụng tra cứu và giải đáp tự động bằng công nghệ AI.
        </div>
      </div>
    </main>
  );
}
