import Link from 'next/link';
import { getOptionalUser } from '@/lib/auth/requireUser';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const user = await getOptionalUser();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-bold">FineSuggest</h1>
        <p className="text-slate-600">
          Trợ lý AI hỏi đáp luật giao thông Việt Nam. Trả lời chính xác dựa trên
          tài liệu chính thức, có trích dẫn nguồn rõ ràng.
        </p>
        <Button asChild size="lg">
          <Link href={user ? '/chat' : '/login'}>
            {user ? 'Vào ứng dụng' : 'Bắt đầu'}
          </Link>
        </Button>
      </div>
    </main>
  );
}
