import { describe, it, expect, vi } from 'vitest';
import { QuotaService, DAILY_QUESTION_LIMIT } from '@/lib/services/QuotaService';

function makeClient(
  readData: { question_count: number } | null,
  upsertResult: { data: { question_count: number } | null; error: unknown }
) {
  // For the select() call in the read phase (maybeSingle)
  const maybeSingle = vi.fn().mockResolvedValue({ data: readData, error: null });
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

  const mockClient = { from, upsert } as unknown as Parameters<typeof QuotaService.prototype.consumeQuestion>[0] extends never
    ? never
    : import('@supabase/supabase-js').SupabaseClient;

  // Expose upsert for assertion
  (mockClient as any).__upsert = upsert;

  return mockClient;
}

describe('QuotaService.consumeQuestion', () => {
  it('returns ok with remaining count on first request of the day', async () => {
    // First request: no prior row (null), should increment from 0 to 1
    const client = makeClient(null, { data: { question_count: 1 }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res).toEqual({ ok: true, remaining: DAILY_QUESTION_LIMIT - 1 });

    // Verify upsert was called with question_count: 1
    const upsert = (client as any).__upsert;
    expect(upsert).toHaveBeenCalled();
    const upsertPayload = upsert.mock.calls[0][0];
    expect(upsertPayload.question_count).toBe(1);
  });

  it('returns ok with 0 remaining at the limit', async () => {
    // Previous state: 49 questions used, should increment to 50
    const client = makeClient(
      { question_count: DAILY_QUESTION_LIMIT - 1 },
      { data: { question_count: DAILY_QUESTION_LIMIT }, error: null }
    );
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res).toEqual({ ok: true, remaining: 0 });

    // Verify upsert was called with question_count: 50
    const upsert = (client as any).__upsert;
    expect(upsert).toHaveBeenCalled();
    const upsertPayload = upsert.mock.calls[0][0];
    expect(upsertPayload.question_count).toBe(DAILY_QUESTION_LIMIT);
  });

  it('returns not-ok when limit exceeded', async () => {
    const client = makeClient(null, { data: { question_count: DAILY_QUESTION_LIMIT + 1 }, error: null });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/quota/i);
  });

  it('returns not-ok on DB error', async () => {
    const client = makeClient(null, { data: null, error: { message: 'boom' } });
    const svc = new QuotaService(client as never);
    const res = await svc.consumeQuestion('user-1');
    expect(res.ok).toBe(false);
  });
});
