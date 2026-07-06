import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import { IngestionError, type LoaderInput, type RawDoc } from '@/lib/ingestion/types';

export class PdfLoader implements DocumentLoader {
  async load(input: LoaderInput): Promise<RawDoc> {
    if (input.kind !== 'buffer') {
      throw new IngestionError('PdfLoader only accepts buffer input', 'load');
    }

    // pdfjs-dist v6 legacy build works in Node.
    // Dynamic import so unit tests that never touch PdfLoader don't pay the parse cost.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    let pdf;
    try {
      pdf = await pdfjs.getDocument({
        data: new Uint8Array(input.buffer),
        disableFontFace: true,
        useSystemFonts: false,
      }).promise;
    } catch (err) {
      throw new IngestionError('Failed to parse PDF', 'load', err);
    }

    const parts: string[] = [];
    const pageMap: Array<{ page: number; start: number; end: number }> = [];
    let cursor = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const start = cursor;
      const end = cursor + pageText.length;
      pageMap.push({ page: i, start, end });
      parts.push(pageText);
      cursor = end + 2; // account for the "\n\n" joiner below
    }

    const content = parts.join('\n\n');

    return {
      content,
      metadata: {
        sourceType: 'pdf',
        title: input.filename,
        pageMap,
        pageCount: pdf.numPages,
      },
    };
  }
}
