import { NextResponse } from 'next/server';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/requireUser';
import { createServerClient } from '@/lib/supabase/server';
import { DocumentService } from '@/lib/services/DocumentService';
import { QuotaService, MAX_FILE_SIZE_MB } from '@/lib/services/QuotaService';

export const runtime = 'nodejs';

const urlSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
    message: 'URL must use http(s) scheme',
  }),
  title: z.string().min(1).max(200),
});

const MIME_TO_SOURCE = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
} as const;

export async function POST(req: Request) {
  const user = await requireUser();
  const supabase = await createServerClient();
  const quota = new QuotaService(supabase);
  const documents = new DocumentService(supabase);

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.startsWith('application/json')) {
    const body = await req.json();
    const parsed = urlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid URL body', issues: parsed.error.issues }, { status: 400 });
    }
    const { id } = await documents.uploadUrl({ userId: user.id, url: parsed.data.url, title: parsed.data.title });
    return NextResponse.json({ id }, { status: 201 });
  }

  if (contentType.startsWith('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    const title = (form.get('title') as string | null) ?? '';
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (title.length === 0) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const quotaCheck = await quota.canUpload(user.id, buffer.byteLength);
    if (!quotaCheck.ok) {
      return NextResponse.json({ error: quotaCheck.reason }, { status: 413 });
    }

    const sniffed = await fileTypeFromBuffer(buffer);
    let mime = sniffed?.mime ?? file.type;
    // .md files sniff as text/plain — trust extension.
    if (file.name.toLowerCase().endsWith('.md')) mime = 'text/markdown';

    const sourceType = MIME_TO_SOURCE[mime as keyof typeof MIME_TO_SOURCE];
    if (!sourceType) {
      return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 415 });
    }

    const { id } = await documents.uploadFile({
      userId: user.id,
      filename: file.name,
      mimeType: mime,
      buffer,
      title,
      sourceType,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
}

export async function GET() {
  const user = await requireUser();
  const supabase = await createServerClient();
  const documents = new DocumentService(supabase);
  const rows = await documents.list(user.id);
  return NextResponse.json({ documents: rows });
}

// Re-export MAX_FILE_SIZE_MB for the client to render limit copy.
export { MAX_FILE_SIZE_MB };
