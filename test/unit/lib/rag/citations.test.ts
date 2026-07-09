import { describe, it, expect } from 'vitest';
import { parseCitations } from '@/lib/rag/citations';

const chunk = (n: number, over: Partial<{ content: string }> = {}) => ({
  id: `c${n}`,
  documentId: `d${n}`,
  content: over.content ?? `Đây là nội dung đoạn ${n} rất dài ${'.'.repeat(20)}`,
  dieu: `Điều ${n}`,
  khoan: `Khoản 1`,
  diem: null,
  page: null,
  similarity: 0.9,
  documentTitle: `Doc ${n}`,
});

describe('parseCitations', () => {
  it('returns citations in first-appearance order', () => {
    const chunks = [chunk(1), chunk(2), chunk(3)];
    const text = 'Theo [2] và [1] và lại [2] rồi [3].';
    const res = parseCitations(text, chunks);
    expect(res.map((c) => c.markerIndex)).toEqual([2, 1, 3]);
    expect(res.map((c) => c.chunkId)).toEqual(['c2', 'c1', 'c3']);
  });

  it('dedupes repeated markers', () => {
    const chunks = [chunk(1), chunk(2)];
    const text = '[1] và [1] rồi [1] cuối cùng.';
    const res = parseCitations(text, chunks);
    expect(res).toHaveLength(1);
    expect(res[0]!.markerIndex).toBe(1);
  });

  it('skips out-of-range markers silently', () => {
    const chunks = [chunk(1)];
    const text = 'Theo [1] và [99] không tồn tại.';
    const res = parseCitations(text, chunks);
    expect(res).toHaveLength(1);
    expect(res[0]!.markerIndex).toBe(1);
  });

  it('truncates snippet to <= 300 chars at word boundary', () => {
    const longContent = 'câu này ' + 'lorem ipsum '.repeat(50);
    const chunks = [{ ...chunk(1), content: longContent }];
    const res = parseCitations('[1]', chunks);
    expect(res[0]!.snippet.length).toBeLessThanOrEqual(300);
    // No trailing partial word: last char is not a space and preceded by a full word.
    expect(res[0]!.snippet).not.toMatch(/\s\S{0,2}$/);
  });

  it('returns empty array when no markers present', () => {
    const chunks = [chunk(1)];
    const res = parseCitations('Câu trả lời không có marker.', chunks);
    expect(res).toEqual([]);
  });

  it('returns empty array on empty text', () => {
    const res = parseCitations('', [chunk(1)]);
    expect(res).toEqual([]);
  });
});
