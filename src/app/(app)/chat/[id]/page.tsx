import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/requireUser';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';
import { ChatShell } from '@/components/chat/ChatShell';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createServerClient();
  const svc = new ConversationService(supabase);

  const owned = await svc.ownedBy(id, user.id);
  if (!owned) notFound();

  const [conversations, messages] = await Promise.all([
    svc.list(user.id),
    svc.getMessages(id, user.id),
  ]);

  const initialMessages: UIMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: 'text', text: m.content }],
  }));

  const initialCitationsByMessageId: Record<string, Citation[]> = {};
  for (const m of messages) {
    if (m.role === 'assistant' && m.citations.length > 0) {
      initialCitationsByMessageId[m.id] = m.citations;
    }
  }

  return (
    <ChatShell
      conversationId={id}
      initialMessages={initialMessages}
      initialCitationsByMessageId={initialCitationsByMessageId}
      sidebar={<ConversationSidebar activeId={id} initialConversations={conversations} />}
    />
  );
}
