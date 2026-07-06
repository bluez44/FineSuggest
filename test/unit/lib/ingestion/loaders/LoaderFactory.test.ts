import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LoaderFactory } from '@/lib/ingestion/loaders/LoaderFactory';
import { PdfLoader } from '@/lib/ingestion/loaders/PdfLoader';
import { DocxLoader } from '@/lib/ingestion/loaders/DocxLoader';
import { TextLoader } from '@/lib/ingestion/loaders/TextLoader';
import { UrlLoader } from '@/lib/ingestion/loaders/UrlLoader';

const fixture = (name: string) => readFileSync(join(__dirname, '../../../../fixtures', name));

describe('LoaderFactory', () => {
  const factory = new LoaderFactory();

  it('routes URL input to UrlLoader', async () => {
    const loader = await factory.forInput({ kind: 'url', url: 'https://x.example' });
    expect(loader).toBeInstanceOf(UrlLoader);
  });

  it('sniffs PDF magic bytes and routes to PdfLoader', async () => {
    const loader = await factory.forInput({
      kind: 'buffer',
      buffer: fixture('sample.pdf'),
      filename: 'unknown.bin',
      mimeType: 'application/octet-stream',
    });
    expect(loader).toBeInstanceOf(PdfLoader);
  });

  it('sniffs DOCX magic bytes and routes to DocxLoader', async () => {
    const loader = await factory.forInput({
      kind: 'buffer',
      buffer: fixture('sample.docx'),
      filename: 'unknown.bin',
      mimeType: 'application/octet-stream',
    });
    expect(loader).toBeInstanceOf(DocxLoader);
  });

  it('routes text/plain buffer to TextLoader', async () => {
    const loader = await factory.forInput({
      kind: 'buffer',
      buffer: Buffer.from('hello'),
      filename: 'x.txt',
      mimeType: 'text/plain',
    });
    expect(loader).toBeInstanceOf(TextLoader);
  });

  it('routes .md filename to TextLoader even if MIME is text/plain', async () => {
    const loader = await factory.forInput({
      kind: 'buffer',
      buffer: Buffer.from('# hello'),
      filename: 'notes.md',
      mimeType: 'text/plain',
    });
    expect(loader).toBeInstanceOf(TextLoader);
  });

  it('throws for unsupported MIME on buffer', async () => {
    await expect(
      factory.forInput({
        kind: 'buffer',
        buffer: Buffer.from('binary\x00data'),
        filename: 'x.exe',
        mimeType: 'application/octet-stream',
      }),
    ).rejects.toThrow(/Unsupported/);
  });
});
