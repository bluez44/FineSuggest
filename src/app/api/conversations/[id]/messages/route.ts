import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const svc = new ConversationService(supabase);
  try {
    const messages = await svc.getMessages(id, user.id);
    return NextResponse.json({ messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    const status = /not found|not owned/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
