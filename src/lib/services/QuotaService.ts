import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILES_PER_USER = 10;

export type QuotaResult = { ok: true } | { ok: false; reason: string };

export class QuotaService {
  constructor(private client: SupabaseClient<Database>) {}

  async canUpload(userId: string, fileSizeBytes: number): Promise<QuotaResult> {
    if (fileSizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { ok: false, reason: `File vượt ${MAX_FILE_SIZE_MB} MB` };
    }
    const { count, error } = await this.client
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId);
    if (error) return { ok: false, reason: 'Không kiểm tra được quota' };
    if ((count ?? 0) >= MAX_FILES_PER_USER) {
      return { ok: false, reason: `Đã đạt giới hạn ${MAX_FILES_PER_USER} tài liệu` };
    }
    return { ok: true };
  }
}
