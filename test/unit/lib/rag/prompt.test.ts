import { describe, it, expect } from 'vitest';
import { buildChatMessages } from '@/lib/rag/prompt';
import { strictRagSystemPrompt } from '@/lib/rag/systemPrompt';

const chunk = (n: number, over: Partial<{ dieu: string | null; khoan: string | null; diem: string | null; documentTitle: string; content: string }> = {}) => ({
  id: `c${n}`,
  documentId: `d${n}`,
  content: over.content ?? `Nội dung đoạn ${n}`,
  dieu: over.dieu ?? `Điều ${n}`,
  khoan: 'khoan' in over ? (over.khoan as string | null) : `Khoản 1`,
  diem: 'diem' in over ? (over.diem as string | null) : null,
  page: null,
  similarity: 0.9,
  documentTitle: over.documentTitle ?? 'Nghị định 100/2019',
});

describe('buildChatMessages', () => {
  it('embeds the strict-RAG system prompt and lists chunks with [n] markers', () => {
    const { system } = buildChatMessages([chunk(1), chunk(2)], [], 'Vượt đèn đỏ phạt bao nhiêu?');
    expect(system.startsWith(strictRagSystemPrompt)).toBe(true);
    expect(system).toContain('CONTEXT:');
    expect(system).toContain('[1] (Điều 1, Khoản 1, Nghị định 100/2019)');
    expect(system).toContain('[2] (Điều 2, Khoản 1, Nghị định 100/2019)');
  });

  it('omits null label parts (no khoan / diem)', () => {
    const c = chunk(5, { khoan: null, diem: null });
    const { system } = buildChatMessages([c], [], 'Hỏi');
    expect(system).toContain('[1] (Điều 5, Nghị định 100/2019)');
    expect(system).not.toContain('Khoản');
    expect(system).not.toContain('Điểm');
  });

  it('prepends history messages before the new user question', () => {
    const { messages } = buildChatMessages(
      [chunk(1)],
      [
        { role: 'user', content: 'Câu 1' },
        { role: 'assistant', content: 'Trả lời 1' },
      ],
      'Câu mới',
    );
    expect(messages).toEqual([
      { role: 'user', content: 'Câu 1' },
      { role: 'assistant', content: 'Trả lời 1' },
      { role: 'user', content: 'Câu mới' },
    ]);
  });

  it('empty history → messages has only the new user question', () => {
    const { messages } = buildChatMessages([chunk(1)], [], 'Chỉ có câu này');
    expect(messages).toEqual([{ role: 'user', content: 'Chỉ có câu này' }]);
  });

  it('handles empty retrieved (still returns valid system with CONTEXT block empty)', () => {
    const { system } = buildChatMessages([], [], 'Câu hỏi');
    expect(system).toContain(strictRagSystemPrompt);
    expect(system).toContain('CONTEXT:');
    expect(system.replace(strictRagSystemPrompt, '').trim().split('\n').every((l) => l === 'CONTEXT:' || l === '')).toBe(true);
  });
});
