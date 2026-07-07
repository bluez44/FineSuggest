import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { createServerClient } from '@/lib/supabase/server';
import { DocumentService } from '@/lib/services/DocumentService';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const supabase = await createServerClient();
  const documents = new DocumentService(supabase);
  const { id } = await params;
  try {
    await documents.delete(user.id, id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === 'Forbidden' ? 403 : message === 'Document not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
  return new NextResponse(null, { status: 204 });
}
