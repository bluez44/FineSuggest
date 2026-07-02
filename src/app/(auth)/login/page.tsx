import { redirect } from 'next/navigation';
import { getOptionalUser } from '@/lib/auth/requireUser';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) {
    redirect('/chat');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">FineSuggest</h1>
          <p className="text-sm text-slate-600">
            Trợ lý AI hỏi đáp luật giao thông Việt Nam
          </p>
        </div>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
