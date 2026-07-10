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
  const [remaining, setRemaining] = useState<number | null>(null);

  const { messages, sendMessage, status } = useChat<UIMessage>({
    transport: transport as never,
    messages: initialMessages,
    onData: (part) => {
      const partObj = part as {
        type: string;
        data?: unknown;
        messageMetadata?: { remaining?: number };
      };
      if (partObj.type === 'data-citations') {
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          setCitationsByMessageId((prev) => ({
            ...prev,
            [last.id]: (partObj.data as Citation[]) ?? [],
          }));
        }
      }
      if (partObj.type === 'data-remaining') {
        setRemaining((partObj.data as number) ?? null);
      }
      if (partObj.type === 'message-metadata' && partObj.messageMetadata?.remaining !== undefined) {
        setRemaining(partObj.messageMetadata.remaining);
      }
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Conversation list sidebar (glass style) */}
      <aside className="hidden md:block w-72 border-r border-white/[0.08] bg-sidebar/20 backdrop-blur-sm shrink-0">
        {sidebar}
      </aside>

      {/* Main chat column */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <MessageList messages={messages} citationsByMessageId={citationsByMessageId} />
        <Composer
          disabled={isStreaming}
          onSubmit={(q) => sendMessage({ text: q })}
          remaining={remaining}
        />
      </div>
    </div>
  );
}
