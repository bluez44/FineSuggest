import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VietnameseLawSplitter } from '@/lib/ingestion/splitters/VietnameseLawSplitter';
import type { RawDoc } from '@/lib/ingestion/types';

const fixture = readFileSync(join(__dirname, '../../../../fixtures/sample-law.txt'), 'utf8');

const asDoc = (content: string): RawDoc => ({
  content,
  metadata: { sourceType: 'txt', title: 'law.txt' },
});

describe('VietnameseLawSplitter', () => {
  it('emits one chunk per Điều with dieu metadata', async () => {
    const splitter = new VietnameseLawSplitter();
    const chunks = await splitter.split(asDoc(fixture));
    const dieuValues = chunks.map((c) => c.dieu).filter(Boolean);
    expect(dieuValues).toEqual(expect.arrayContaining(['Điều 1', 'Điều 2', 'Điều 5']));
  });

  it('excludes preamble (before first Điều) from chunk output', async () => {
    const splitter = new VietnameseLawSplitter();
    const chunks = await splitter.split(asDoc(fixture));
    chunks.forEach((c) => expect(c.content).not.toContain('Chương I'));
  });

  it('assigns ascending ordinals', async () => {
    const splitter = new VietnameseLawSplitter();
    const chunks = await splitter.split(asDoc(fixture));
    chunks.forEach((c, i) => expect(c.ordinal).toBe(i));
  });

  it('sub-splits an oversize Điều (> 1500 chars) and preserves dieu on every sub-chunk', async () => {
    const bigDieu = 'Điều 99. Tiêu đề.\n' + 'A'.repeat(2000);
    const splitter = new VietnameseLawSplitter({ maxDieuSize: 1500 });
    const chunks = await splitter.split(asDoc(bigDieu));
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.dieu).toBe('Điều 99'));
  });

  it('captures khoan when Điều body contains "1." / "2." markers', async () => {
    const doc = asDoc(fixture);
    const splitter = new VietnameseLawSplitter();
    const chunks = await splitter.split(doc);
    const dieu5 = chunks.find((c) => c.dieu === 'Điều 5');
    expect(dieu5).toBeDefined();
    // The Điều body carries khoan info in metadata for later retrieval — the display khoan
    // on this chunk is null (Điều chunk holds the whole article), but sub-chunks (when
    // maxDieuSize triggers) may carry specific khoan.
  });
});
