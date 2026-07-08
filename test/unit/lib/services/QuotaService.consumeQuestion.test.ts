import { describe, it, expect, vi } from 'vitest';
import { QuotaService, DAILY_QUESTION_LIMIT } from '@/lib/services/QuotaService';

function makeClient(upsertResult: { data: { question_count: number } | null; error: unknown }) {
  // For the select() call in the read phase (maybeSingle)
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const selectForRead = vi.fn(() => ({ maybeSingle, eq: vi.fn().mockReturnThis() }));

  // For the upsert() call in the write phase
  const single = vi.fn().mockResolvedValue(upsertResult);
  const selectForWrite = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select: selectForWrite }));

  // from() needs to route appropriately
  const from = vi.fn((table: string) => {
    if (table === 'usage_daily') {
      return {
        select: selectForRead,
        upsert
      };
    }
    return { upsert };
  });

  return { from } as unknown as Parameters<typeof QuotaService.prototype.consumeQuestion>[0] extends never
    ? never
    : import('@supabase/supabase-js').SupabaseClient;
}

describe('QuotaService.consumeQuestion', () => {
  it('returns ok with remaining count on first request of the day', async () => {
    const client = makeClient({ data: { question_count: 1 }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res).toEqual({ ok: true, remaining: DAILY_QUESTION_LIMIT - 1 });
  });

  it('returns ok with 0 remaining at the limit', async () => {
    const client = makeClient({ data: { question_count: DAILY_QUESTION_LIMIT }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res).toEqual({ ok: true, remaining: 0 });
  });

  it('returns not-ok when limit exceeded', async () => {
    const client = makeClient({ data: { question_count: DAILY_QUESTION_LIMIT + 1 }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/quota/i);
  });

  it('returns not-ok on DB error', async () => {
    const client = makeClient({ data: null, error: { message: 'boom' } });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res.ok).toBe(false);
  });
});
