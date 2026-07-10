'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { MessageBubble } from './MessageBubble';
import { Scale } from 'lucide-react';

interface Props {
  messages: UIMessage[];
  citationsByMessageId: Record<string, Citation[]>;
}

export function MessageList({ messages, citationsByMessageId }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div ref={ref} className="flex-1 space-y-6 overflow-y-auto whitespace-pre-wrap p-6 bg-transparent">
      {messages.length === 0 ? (
        <div className="mx-auto max-w-2xl text-center space-y-8 my-auto py-12 flex flex-col items-center justify-center min-h-[60%]">
          <div className="p-4 rounded-full bg-primary/10 border border-primary/20 text-primary animate-float">
            <Scale className="h-10 w-10" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Hỏi đáp Luật giao thông Việt Nam</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Nhập câu hỏi của bạn dưới đây. AI sẽ tra cứu quy định pháp luật chính thống và phản hồi kèm trích dẫn nguồn chi tiết.
            </p>
          </div>

          {/* Prompt Suggestions */}
          <div className="grid gap-3 sm:grid-cols-2 w-full max-w-lg pt-4 text-left">
            <div className="glass-card p-4 rounded-xl hover:bg-white/5 border border-white/[0.06] transition-colors cursor-pointer text-xs space-y-1">
              <span className="font-semibold text-primary">Vi phạm nồng độ cồn</span>
              <p className="text-muted-foreground">Mức phạt nồng độ cồn cao nhất đối với người điều khiển xe máy?</p>
            </div>
            <div className="glass-card p-4 rounded-xl hover:bg-white/5 border border-white/[0.06] transition-colors cursor-pointer text-xs space-y-1">
              <span className="font-semibold text-accent">Giấy tờ xe</span>
              <p className="text-muted-foreground">Lỗi không mang giấy đăng ký xe và bằng lái xe phạt bao nhiêu?</p>
            </div>
            <div className="glass-card p-4 rounded-xl hover:bg-white/5 border border-white/[0.06] transition-colors cursor-pointer text-xs space-y-1">
              <span className="font-semibold text-emerald-400">Tốc độ giới hạn</span>
              <p className="text-muted-foreground">Chạy quá tốc độ quy định từ 5 đến dưới 10 km/h bị phạt thế nào?</p>
            </div>
            <div className="glass-card p-4 rounded-xl hover:bg-white/5 border border-white/[0.06] transition-colors cursor-pointer text-xs space-y-1">
              <span className="font-semibold text-amber-400 font-sans">Đèn tín hiệu</span>
              <p className="text-muted-foreground">Hành vi vượt đèn vàng có bị xử phạt như vượt đèn đỏ không?</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} citations={citationsByMessageId[m.id] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
