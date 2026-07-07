import { describe, it, expect } from 'vitest';
import { QuotaService, MAX_FILE_SIZE_MB, MAX_FILES_PER_USER } from '@/lib/services/QuotaService';

function fakeClient(currentCount: number) {
  return {
    from(_table: string) {
      return {
        select: (_col: string, _opts?: unknown) => ({
          eq: (_c: string, _v: unknown) => Promise.resolve({ count: currentCount, error: null }),
        }),
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('QuotaService', () => {
  it('allows upload under both limits', async () => {
    const q = new QuotaService(fakeClient(3));
    const r = await q.canUpload('u-1', 5 * 1024 * 1024);
    expect(r).toEqual({ ok: true });
  });

  it('rejects file over MAX_FILE_SIZE_MB', async () => {
    const q = new QuotaService(fakeClient(0));
    const r = await q.canUpload('u-1', (MAX_FILE_SIZE_MB + 1) * 1024 * 1024);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining('20 MB') });
  });

  it('rejects when at MAX_FILES_PER_USER', async () => {
    const q = new QuotaService(fakeClient(MAX_FILES_PER_USER));
    const r = await q.canUpload('u-1', 1024);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining(`${MAX_FILES_PER_USER}`) });
  });
});
