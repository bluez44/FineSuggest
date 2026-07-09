'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX}
          placeholder="Hỏi về luật giao thông…"
          disabled={disabled}
          className="min-h-[52px] flex-1 resize-none"
        />
        <Button type="submit" disabled={disabled || text.trim().length === 0}>
          Gửi
        </Button>
      </div>
      <div className="mt-1 text-right text-xs text-slate-500">
        {remaining !== null && remaining !== undefined
          ? `Còn ${remaining} câu hôm nay`
          : `${text.length}/${MAX}`}
      </div>
    </form>
  );
}
