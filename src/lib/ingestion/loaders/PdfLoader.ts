import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import { IngestionError, type LoaderInput, type RawDoc } from '@/lib/ingestion/types';

export class PdfLoader implements DocumentLoader {
  async load(input: LoaderInput): Promise<RawDoc> {
    if (input.kind !== 'buffer') {
      throw new IngestionError('PdfLoader only accepts buffer input', 'load');
    }

    // pdfjs-dist v6 legacy build works in Node.
    // Load the canvas polyfills first so pdf.js does not warn/fail when it tries
    // to resolve DOMMatrix / Path2D in serverless Node runtimes.
    await ensurePdfCanvasPolyfills();

    // pdf.js still sets up a fake worker in Node, so preload the worker handler
    // and attach it to the expected global to avoid importing workerSrc by path.
    await ensurePdfWorkerHandler();

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
      throw new IngestionError(
        'Failed to parse PDF' + (err instanceof Error ? err.message : String(err)),
        'load',
        err,
      );
    }

    const parts: string[] = [];
    const pageMap: Array<{ page: number; start: number; end: number }> = [];
    let cursor = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => (isTextItem(item) ? item.str : ''))
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

function isTextItem(item: unknown): item is { str: string } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as { str?: unknown }).str === 'string'
  );
}

async function ensurePdfCanvasPolyfills() {
  const globals = globalThis as typeof globalThis & {
    DOMMatrix?: typeof globalThis.DOMMatrix;
    Path2D?: typeof globalThis.Path2D;
    ImageData?: typeof globalThis.ImageData;
  };

  if (globals.DOMMatrix && globals.Path2D && globals.ImageData) {
    return;
  }

  const canvas = await import('@napi-rs/canvas');
  globals.DOMMatrix ??= canvas.DOMMatrix as unknown as typeof globalThis.DOMMatrix;
  globals.Path2D ??= canvas.Path2D as unknown as typeof globalThis.Path2D;
  globals.ImageData ??= canvas.ImageData as unknown as typeof globalThis.ImageData;
}

async function ensurePdfWorkerHandler() {
  const globals = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };

  if (globals.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  // pdfjs-dist ships the worker file, but its TypeScript typings do not expose it.
  // @ts-expect-error - pdfjs-dist does not declare the legacy worker module.
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  globals.pdfjsWorker = {
    WorkerMessageHandler: worker.WorkerMessageHandler,
  };
}
