import { describe, it, expect } from 'vitest';
import { RecursiveSplitter } from '@/lib/ingestion/splitters/RecursiveSplitter';
import type { RawDoc } from '@/lib/ingestion/types';

describe('RecursiveSplitter', () => {
  it('splits a long doc into multiple ordered chunks', async () => {
    const content = 'A'.repeat(2500);
    const doc: RawDoc = { content, metadata: { sourceType: 'txt', title: 'x.txt' } };
    const splitter = new RecursiveSplitter({ chunkSize: 800, chunkOverlap: 100 });
    const chunks = await splitter.split(doc);
    expect(chunks.length).toBeGreaterThan(2);
    chunks.forEach((c, i) => expect(c.ordinal).toBe(i));
    chunks.forEach((c) => expect(c.content.length).toBeLessThanOrEqual(800));
  });

  it('preserves overlap between adjacent chunks', async () => {
    const content = Array.from({ length: 40 }, (_, i) => `sentence ${i}. `).join('');
    const doc: RawDoc = { content, metadata: { sourceType: 'txt', title: 'x.txt' } };
    const splitter = new RecursiveSplitter({ chunkSize: 200, chunkOverlap: 50 });
    const chunks = await splitter.split(doc);
    expect(chunks.length).toBeGreaterThan(1);
    // Overlap: some suffix of chunk[0] appears as prefix of chunk[1]
    const tail = chunks[0]!.content.slice(-20);
    expect(chunks[1]!.content).toContain(tail.trim().slice(-10));
  });

  it('attaches page from pageMap when chunk falls within page range', async () => {
    const page1 = 'Page one content. '.repeat(30); // ~540 chars
    const page2 = 'Page two content. '.repeat(30);
    const content = page1 + '\n\n' + page2;
    const doc: RawDoc = {
      content,
      metadata: {
        sourceType: 'pdf',
        title: 'x.pdf',
        pageMap: [
          { page: 1, start: 0, end: page1.length },
          { page: 2, start: page1.length + 2, end: content.length },
        ],
      },
    };
    const splitter = new RecursiveSplitter({ chunkSize: 400, chunkOverlap: 50 });
    const chunks = await splitter.split(doc);
    expect(chunks.some((c) => c.page === 1)).toBe(true);
    expect(chunks.some((c) => c.page === 2)).toBe(true);
  });
});
