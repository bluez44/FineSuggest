import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TextLoader } from '@/lib/ingestion/loaders/TextLoader';

const fixture = (name: string) => readFileSync(join(__dirname, '../../../../fixtures', name));

describe('TextLoader', () => {
  it('loads a UTF-8 .txt buffer as RawDoc with sourceType=txt', async () => {
    const loader = new TextLoader();
    const doc = await loader.load({
      kind: 'buffer',
      buffer: fixture('sample-plain.txt'),
      filename: 'sample-plain.txt',
      mimeType: 'text/plain',
    });
    expect(doc.metadata.sourceType).toBe('txt');
    expect(doc.metadata.title).toBe('sample-plain.txt');
    expect(doc.content).toContain('Điều 5');
    expect(doc.content).toContain('800.000');
  });

  it('loads a .md buffer with sourceType=md and strips markdown syntax to plain text', async () => {
    const loader = new TextLoader();
    const doc = await loader.load({
      kind: 'buffer',
      buffer: fixture('sample-law.md'),
      filename: 'sample-law.md',
      mimeType: 'text/markdown',
    });
    expect(doc.metadata.sourceType).toBe('md');
    // Bold marker ** must be stripped; heading # must be stripped.
    expect(doc.content).not.toContain('**');
    expect(doc.content).not.toMatch(/^#\s/m);
    expect(doc.content).toContain('Điều 6');
  });

  it('normalizes CRLF to LF and collapses 3+ blank lines to 2', async () => {
    const loader = new TextLoader();
    const doc = await loader.load({
      kind: 'buffer',
      buffer: Buffer.from('A\r\n\r\n\r\n\r\nB'),
      filename: 'x.txt',
      mimeType: 'text/plain',
    });
    expect(doc.content).toBe('A\n\nB');
  });

  it('throws for kind=url input (TextLoader is buffer-only)', async () => {
    const loader = new TextLoader();
    await expect(
      loader.load({ kind: 'url', url: 'http://x.example' }),
    ).rejects.toThrow(/TextLoader/);
  });
});
