import { describe, it, expect } from 'vitest';
import { buildChatMessages, type SessionDocument } from '@/lib/rag/prompt';
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

  it('empty retrieved → CONTEXT block contains explicit "no chunks" marker', () => {
    const { system } = buildChatMessages([], [], 'Câu hỏi');
    expect(system).toContain(strictRagSystemPrompt);
    expect(system).toContain('CONTEXT:');
    expect(system).toContain('(không có đoạn trích liên quan)');
  });

  it('SESSION INFO defaults to empty state when no sessionDocs given', () => {
    const { system } = buildChatMessages([], [], 'Câu hỏi');
    expect(system).toContain('SESSION INFO:');
    expect(system).toContain('Tài liệu người dùng đã tải lên: (chưa có)');
    expect(system).toContain('Tài liệu công khai của hệ thống: (chưa có)');
  });

  it('SESSION INFO lists private and public docs in separate groups', () => {
    const docs: SessionDocument[] = [
      { title: 'Nghị định 100/2019', visibility: 'public' },
      { title: 'Ghi chú cá nhân', visibility: 'private' },
      { title: 'Luật giao thông đường bộ', visibility: 'public' },
    ];
    const { system } = buildChatMessages([], [], 'Bạn có thể giúp gì?', docs);
    expect(system).toMatch(/Tài liệu người dùng đã tải lên:\n- Ghi chú cá nhân/);
    expect(system).toMatch(/Tài liệu công khai của hệ thống:\n- Nghị định 100\/2019\n- Luật giao thông đường bộ/);
  });

  it('SESSION INFO empty label when one group is empty', () => {
    const docs: SessionDocument[] = [{ title: 'Chỉ private', visibility: 'private' }];
    const { system } = buildChatMessages([], [], 'H', docs);
    expect(system).toContain('Tài liệu người dùng đã tải lên:\n- Chỉ private');
    expect(system).toContain('Tài liệu công khai của hệ thống: (chưa có)');
  });
});
