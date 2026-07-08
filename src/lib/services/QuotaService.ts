import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILES_PER_USER = 10;
export const DAILY_QUESTION_LIMIT = 50;

export type QuotaResult = { ok: true } | { ok: false; reason: string };
export type ConsumeResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: string };

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

  async consumeQuestion(userId: string): Promise<ConsumeResult> {
    const today = new Date().toISOString().slice(0, 10);

    // Atomic upsert: on conflict, increment via a raw expression.
    // Supabase JS's upsert cannot express `col + 1`, so use RPC-less trick:
    // fetch-then-update in a single call by calling the increment RPC.
    // Alternative that works with only table access: select-then-upsert atomically
    // via server-side merge — Supabase's upsert with default values does NOT
    // atomically increment. To keep this atomic without a DB function, use a
    // Postgres-only path via SQL through client.rpc('increment_usage', {...})
    // — but adding an RPC is a migration.
    //
    // For v1 we implement a two-step read-then-write and accept the small
    // race window: two concurrent requests may both see N and both write N+1,
    // undercounting by 1. Documented in the review doc for Plan 4 hardening.

    const { data: existing, error: selErr } = await this.client
      .from('usage_daily')
      .select('question_count')
      .eq('user_id', userId)
      .eq('day', today)
      .maybeSingle();
    if (selErr) return { ok: false, reason: 'Không đọc được quota' };

    const nextCount = (existing?.question_count ?? 0) + 1;

    const { data, error } = await this.client
      .from('usage_daily')
      .upsert(
        { user_id: userId, day: today, question_count: nextCount },
        { onConflict: 'user_id,day' },
      )
      .select('question_count')
      .single();

    if (error || !data) return { ok: false, reason: 'Không cập nhật được quota' };

    if (data.question_count > DAILY_QUESTION_LIMIT) {
      return { ok: false, reason: `Quota hết: Bạn đã dùng hết ${DAILY_QUESTION_LIMIT} câu hỏi hôm nay` };
    }
    return { ok: true, remaining: DAILY_QUESTION_LIMIT - data.question_count };
  }
}
