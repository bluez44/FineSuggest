import { describe, it, expect, vi } from 'vitest';
import { ConversationService } from '@/lib/services/ConversationService';

function chain(final: unknown) {
  const p: Record<string, unknown> = {};
  const attach = (name: string, ret: unknown = p) => (p[name] = vi.fn(() => ret));
  attach('select'); attach('insert'); attach('update'); attach('delete');
  attach('eq'); attach('order'); attach('limit'); attach('lt'); attach('neq');
  attach('in'); attach('single', final); attach('maybeSingle', final);
  return p;
}

describe('ConversationService', () => {
  it('list orders by updated_at desc, returns camelCase rows', async () => {
    const rows = [
      { id: 'c1', title: 't1', updated_at: '2026-07-08T10:00:00Z' },
      { id: 'c2', title: 't2', updated_at: '2026-07-08T09:00:00Z' },
    ];
    const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: rows, error: null }) }));
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ order: () => Promise.resolve({ data: rows, error: null }) })) }));
    const from = vi.fn(() => ({ select }));
    const svc = new ConversationService({ from } as never);
    const res = await svc.list('user-1');
    expect(res).toEqual([
      { id: 'c1', title: 't1', updatedAt: '2026-07-08T10:00:00Z' },
      { id: 'c2', title: 't2', updatedAt: '2026-07-08T09:00:00Z' },
    ]);
  });

  it('create inserts row and returns id + default title', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'c-new', title: 'Cuộc trò chuyện mới' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const svc = new ConversationService({ from } as never);
    const res = await svc.create('user-1');
    expect(res.id).toBe('c-new');
    expect(res.title).toBe('Cuộc trò chuyện mới');
    expect(insert).toHaveBeenCalledWith({ owner_id: 'user-1' });
  });

  it('rename throws when no row updated (not owned or not found)', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
    const eqOwner = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqOwner }));
    const update = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ update }));
    const svc = new ConversationService({ from } as never);
    await expect(svc.rename('c-x', 'user-1', 'new title')).rejects.toThrow(/not found|owned/i);
  });

  it('getRecentMessages returns id+role+content, oldest→newest, N-limited', async () => {
    const rows = [
      { id: 'm4', role: 'assistant', content: 'A2', created_at: '2026-07-08T09:02:00Z' },
      { id: 'm3', role: 'user', content: 'Q2', created_at: '2026-07-08T09:01:00Z' },
      { id: 'm2', role: 'assistant', content: 'A1', created_at: '2026-07-08T09:00:30Z' },
      { id: 'm1', role: 'user', content: 'Q1', created_at: '2026-07-08T09:00:00Z' },
    ];
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const svc = new ConversationService({ from } as never);
    const res = await svc.getRecentMessages('c-1', 4);
    expect(res).toEqual([
      { id: 'm1', role: 'user', content: 'Q1' },
      { id: 'm2', role: 'assistant', content: 'A1' },
      { id: 'm3', role: 'user', content: 'Q2' },
      { id: 'm4', role: 'assistant', content: 'A2' },
    ]);
  });

  it('appendMessage writes role + content + citations JSONB, returns new id', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'm-new' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    // Follow-up touch: .from('conversations').update().eq()
    const touchEq = vi.fn().mockResolvedValue({ error: null });
    const touchUpdate = vi.fn(() => ({ eq: touchEq }));
    const from = vi.fn((table: string) => {
      if (table === 'messages') return { insert };
      if (table === 'conversations') return { update: touchUpdate };
      return { insert };
    });
    const svc = new ConversationService({ from } as never);
    const citations = [{ chunkId: 'x', documentId: 'd', dieu: null, khoan: null, diem: null, page: null, documentTitle: 'T', snippet: 's', markerIndex: 1 }];
    const res = await svc.appendMessage('c-1', 'assistant', 'hello', citations);
    expect(res.id).toBe('m-new');
    expect(insert).toHaveBeenCalledWith({
      conversation_id: 'c-1',
      role: 'assistant',
      content: 'hello',
      citations,
    });
    expect(touchUpdate).toHaveBeenCalledWith(expect.objectContaining({ updated_at: expect.any(String) }));
    expect(touchEq).toHaveBeenCalledWith('id', 'c-1');
  });

  it('ownedBy returns true when exists, false when null', async () => {
    const maybeSingleTrue = vi.fn().mockResolvedValue({ data: { id: 'c-1' }, error: null });
    const eqOwnerT = vi.fn(() => ({ maybeSingle: maybeSingleTrue }));
    const eqIdT = vi.fn(() => ({ eq: eqOwnerT }));
    const selectT = vi.fn(() => ({ eq: eqIdT }));
    const fromT = vi.fn(() => ({ select: selectT }));
    const svcT = new ConversationService({ from: fromT } as never);
    expect(await svcT.ownedBy('c-1', 'u-1')).toBe(true);

    const maybeSingleFalse = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqOwnerF = vi.fn(() => ({ maybeSingle: maybeSingleFalse }));
    const eqIdF = vi.fn(() => ({ eq: eqOwnerF }));
    const selectF = vi.fn(() => ({ eq: eqIdF }));
    const fromF = vi.fn(() => ({ select: selectF }));
    const svcF = new ConversationService({ from: fromF } as never);
    expect(await svcF.ownedBy('c-1', 'u-1')).toBe(false);
  });
});
