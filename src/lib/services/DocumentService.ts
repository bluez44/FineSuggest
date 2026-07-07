import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const BUCKET = 'documents';

export interface UploadFileInput {
  userId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  title: string;
  sourceType: 'pdf' | 'docx' | 'txt' | 'md';
}

export interface UploadUrlInput {
  userId: string;
  url: string;
  title: string;
}

export class DocumentService {
  constructor(private client: SupabaseClient<Database>) {}

  async uploadFile(input: UploadFileInput): Promise<{ id: string; storagePath: string }> {
    const documentId = crypto.randomUUID();
    const ext = input.filename.slice(input.filename.lastIndexOf('.'));
    const storagePath = `${input.userId}/${documentId}${ext}`;

    const uploadRes = await this.client.storage
      .from(BUCKET)
      .upload(storagePath, input.buffer, {
        contentType: input.mimeType,
        upsert: false,
      });
    if (uploadRes.error) {
      throw new Error(`Storage upload failed: ${uploadRes.error.message}`);
    }

    const insertRes = await this.client
      .from('documents')
      .insert({
        id: documentId,
        owner_id: input.userId,
        visibility: 'private',
        source_type: input.sourceType,
        title: input.title,
        storage_path: storagePath,
        status: 'pending',
      });
    if (insertRes.error) {
      // best effort cleanup
      await this.client.storage.from(BUCKET).remove([storagePath]);
      throw new Error(`Document row insert failed: ${insertRes.error.message}`);
    }

    return { id: documentId, storagePath };
  }

  async uploadUrl(input: UploadUrlInput): Promise<{ id: string }> {
    const documentId = crypto.randomUUID();
    const insertRes = await this.client
      .from('documents')
      .insert({
        id: documentId,
        owner_id: input.userId,
        visibility: 'private',
        source_type: 'url',
        title: input.title,
        source_url: input.url,
        status: 'pending',
      });
    if (insertRes.error) throw new Error(`Document row insert failed: ${insertRes.error.message}`);
    return { id: documentId };
  }

  async list(userId: string) {
    const { data, error } = await this.client
      .from('documents')
      .select('id, title, source_type, status, error_message, visibility, source_url, created_at, updated_at')
      .or(`owner_id.eq.${userId},visibility.eq.public`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`List documents failed: ${error.message}`);
    return data;
  }

  async delete(userId: string, documentId: string): Promise<void> {
    // RLS enforces owner; verify + fetch storage_path first.
    const { data: doc, error: fetchErr } = await this.client
      .from('documents')
      .select('storage_path, owner_id')
      .eq('id', documentId)
      .single();
    if (fetchErr || !doc) throw new Error('Document not found');
    if (doc.owner_id !== userId) throw new Error('Forbidden');

    const { error: delErr } = await this.client.from('documents').delete().eq('id', documentId);
    if (delErr) throw new Error(`Delete failed: ${delErr.message}`);

    if (doc.storage_path) {
      await this.client.storage.from(BUCKET).remove([doc.storage_path]);
    }
  }
}
