import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocxLoader } from '@/lib/ingestion/loaders/DocxLoader';

const fixture = (name: string) => readFileSync(join(__dirname, '../../../../fixtures', name));

describe('DocxLoader', () => {
  it('extracts text from a DOCX preserving Vietnamese diacritics', async () => {
    const loader = new DocxLoader();
    const doc = await loader.load({
      kind: 'buffer',
      buffer: fixture('sample.docx'),
      filename: 'sample.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(doc.metadata.sourceType).toBe('docx');
    expect(doc.metadata.title).toBe('sample.docx');
    expect(doc.content).toContain('Điều 1');
    expect(doc.content).toContain('Điều 2');
  });

  it('throws on invalid docx bytes', async () => {
    const loader = new DocxLoader();
    await expect(
      loader.load({
        kind: 'buffer',
        buffer: Buffer.from('not a docx'),
        filename: 'x.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ).rejects.toThrow();
  });
});
