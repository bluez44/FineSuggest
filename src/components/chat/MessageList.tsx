'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { MessageBubble } from './MessageBubble';

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
    <div ref={ref} className="flex-1 space-y-3 overflow-y-auto whitespace-pre-wrap bg-slate-50 p-4">
      {messages.length === 0 ? (
        <p className="mx-auto max-w-md text-center text-sm text-slate-500">
          Đặt câu hỏi về luật giao thông để bắt đầu.
        </p>
      ) : null}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} citations={citationsByMessageId[m.id] ?? []} />
      ))}
    </div>
  );
}
