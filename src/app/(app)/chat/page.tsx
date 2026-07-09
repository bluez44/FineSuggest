import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/requireUser';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export default async function ChatIndexPage() {
  const user = await requireUser();
  const supabase = await createServerClient();
  const svc = new ConversationService(supabase);
  const list = await svc.list(user.id);

  if (list.length > 0) redirect(`/chat/${list[0]!.id}`);
  const created = await svc.create(user.id);
  redirect(`/chat/${created.id}`);
}
