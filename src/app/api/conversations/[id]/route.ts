import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationService } from '@/lib/services/ConversationService';

export const runtime = 'nodejs';

const renameSchema = z.object({ title: z.string().min(1).max(200) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid title', issues: parsed.error.issues }, { status: 400 });
  }

  const svc = new ConversationService(supabase);
  try {
    await svc.rename(id, user.id, parsed.data.title);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    const status = /not found|not owned/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const svc = new ConversationService(supabase);
  const owned = await svc.ownedBy(id, user.id);
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await svc.delete(id, user.id);
  return new NextResponse(null, { status: 204 });
}
