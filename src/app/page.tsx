import Link from 'next/link';
import { getOptionalUser } from '@/lib/auth/requireUser';
import { Button } from '@/components/ui/button';
import { Scale, BookOpen, ShieldCheck, ArrowRight } from 'lucide-react';

export default async function HomePage() {
  const user = await getOptionalUser();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-primary/20 blur-[80px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-[350px] w-[350px] rounded-full bg-accent/15 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl space-y-12 text-center">
        {/* Brand Hero */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-ping" />
            <span>Trợ lý Luật giao thông thông minh</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            <span className="text-gradient bg-gradient-to-r from-violet-400 via-indigo-200 to-cyan-300">FineSuggest</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            Tra cứu và giải đáp luật giao thông đường bộ Việt Nam tức thì. Trả lời chính xác dựa trên tài liệu pháp lý chính thức và có dẫn nguồn rõ ràng.
          </p>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="h-12 px-8 text-base font-medium shadow-lg hover:shadow-primary/25 transition-all bg-gradient-to-r from-primary to-violet-600 hover:opacity-95">
            <Link href={user ? '/chat' : '/login'} className="inline-flex items-center gap-2">
              {user ? 'Vào ứng dụng' : 'Bắt đầu sử dụng'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {!user && (
            <Button asChild variant="outline" size="lg" className="h-12 px-8 border-white/10 hover:bg-white/5 bg-transparent text-foreground">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          )}
        </div>

        {/* Feature grid */}
        <div className="grid gap-6 md:grid-cols-3 pt-8">
          <div className="glass-card flex flex-col items-center p-8 rounded-2xl text-center space-y-4 hover:border-white/15 transition-all">
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Scale className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">AI Trả Lời Chính Xác</h3>
            <p className="text-sm text-muted-foreground">
              Phân tích các tình huống vi phạm, đề xuất mức xử phạt tối ưu dựa trên quy định pháp luật.
            </p>
          </div>

          <div className="glass-card flex flex-col items-center p-8 rounded-2xl text-center space-y-4 hover:border-white/15 transition-all">
            <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Trích Dẫn Rõ Ràng</h3>
            <p className="text-sm text-muted-foreground">
              Mỗi câu trả lời đi kèm với điều khoản, nghị định cụ thể giúp bạn dễ dàng đối chiếu, tự tin làm chủ.
            </p>
          </div>

          <div className="glass-card flex flex-col items-center p-8 rounded-2xl text-center space-y-4 hover:border-white/15 transition-all">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground font-sans">Nguồn Chính Thống</h3>
            <p className="text-sm text-muted-foreground">
              Hệ thống được nạp các tài liệu luật, nghị định, thông tư chính thức của chính phủ.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
