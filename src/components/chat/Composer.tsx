'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendHorizontal, Sparkles } from 'lucide-react';

interface Props {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  remaining?: number | null;
}

const MAX = 2000;

export function Composer({ onSubmit, disabled, remaining }: Props) {
  const [text, setText] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setText('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <div className="border-t border-white/[0.08] bg-background/80 backdrop-blur-xl p-4">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-2">
        <div className="relative flex items-end gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 hover:border-white/15 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX}
            placeholder="Đặt câu hỏi về luật giao thông..."
            disabled={disabled}
            className="min-h-[44px] max-h-[160px] flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 scrollbar-none"
          />
          <Button
            type="submit"
            disabled={disabled || text.trim().length === 0}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-primary-foreground transition-all hover:opacity-95 disabled:bg-white/5 disabled:text-muted-foreground/40 active:scale-95"
          >
            <SendHorizontal className="h-4.5 w-4.5" />
            <span className="sr-only">Gửi</span>
          </Button>
        </div>

        <div className="flex items-center justify-between px-2 text-[11px] text-muted-foreground/70">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-accent animate-pulse" />
            <span>AI sẽ trả lời dựa trên cơ sở dữ liệu pháp luật hiện hành.</span>
          </div>
          <div>
            {remaining !== null && remaining !== undefined ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                Hôm nay còn {remaining} câu hỏi
              </span>
            ) : (
              <span>{text.length}/{MAX} ký tự</span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
