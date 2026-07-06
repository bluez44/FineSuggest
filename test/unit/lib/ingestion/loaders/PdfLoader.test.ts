import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PdfLoader } from '@/lib/ingestion/loaders/PdfLoader';

const fixture = (name: string) => readFileSync(join(__dirname, '../../../../fixtures', name));

describe('PdfLoader', () => {
  it('extracts text from a 2-page PDF and reports 2 page entries', async () => {
    const loader = new PdfLoader();
    const doc = await loader.load({
      kind: 'buffer',
      buffer: fixture('sample.pdf'),
      filename: 'sample.pdf',
      mimeType: 'application/pdf',
    });
    expect(doc.metadata.sourceType).toBe('pdf');
    expect(doc.metadata.title).toBe('sample.pdf');
    expect(doc.content).toContain('Article one');
    expect(doc.content).toContain('Article two');
    expect(doc.metadata.pageMap).toBeDefined();
    expect(doc.metadata.pageMap).toHaveLength(2);
    expect(doc.metadata.pageMap![0]!.page).toBe(1);
    expect(doc.metadata.pageMap![1]!.page).toBe(2);
  });

  it('pageMap start/end offsets bracket each page in content', async () => {
    const loader = new PdfLoader();
    const doc = await loader.load({
      kind: 'buffer',
      buffer: fixture('sample.pdf'),
      filename: 'sample.pdf',
      mimeType: 'application/pdf',
    });
    const map = doc.metadata.pageMap!;
    for (const entry of map) {
      const slice = doc.content.slice(entry.start, entry.end);
      expect(slice.length).toBeGreaterThan(0);
    }
  });

  it('throws on non-PDF buffer', async () => {
    const loader = new PdfLoader();
    await expect(
      loader.load({
        kind: 'buffer',
        buffer: Buffer.from('not a pdf'),
        filename: 'x.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow();
  });
});
