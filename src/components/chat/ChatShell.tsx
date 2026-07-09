'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

interface Props {
  conversationId: string;
  initialMessages: UIMessage[];
  initialCitationsByMessageId: Record<string, Citation[]>;
  sidebar: ReactNode;
}

export function ChatShell({
  conversationId,
  initialMessages,
  initialCitationsByMessageId,
  sidebar,
}: Props) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, data: { conversationId } },
        }),
      }),
    [conversationId],
  );

  const [citationsByMessageId, setCitationsByMessageId] = useState<Record<string, Citation[]>>(
    initialCitationsByMessageId,
  );

  const { messages, sendMessage, status } = useChat<UIMessage>({
    // cast required: DefaultChatTransport<UIMessage> is not assignable to
    // ChatTransport<UIMessage> as seen by @ai-sdk/react v4 due to its stricter
    // generic variance — pre-authorized by task brief.
    transport: transport as never,
    messages: initialMessages,
    onData: (part) => {
      // Custom data-citations parts land here as { type: 'data-citations', data: Citation[] }.
      // Cast to any is required because UIMessage has no DATA_PARTS generic bound here.
      if ((part as any).type === 'data-citations') {
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          setCitationsByMessageId((prev) => ({
            ...prev,
            [last.id]: (part as any).data as Citation[],
          }));
        }
      }
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <aside className="hidden w-64 border-r border-slate-200 bg-white md:block">{sidebar}</aside>
      <div className="flex flex-1 flex-col">
        <MessageList messages={messages} citationsByMessageId={citationsByMessageId} />
        <Composer
          disabled={isStreaming}
          onSubmit={(q) => sendMessage({ text: q })}
          remaining={null}
        />
      </div>
    </div>
  );
}
