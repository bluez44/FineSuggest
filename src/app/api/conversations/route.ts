import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = new ConversationService(supabase);
  const conversations = await svc.list(user.id);
  return NextResponse.json({ conversations });
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = new ConversationService(supabase);
  const created = await svc.create(user.id);
  return NextResponse.json(created, { status: 201 });
}
