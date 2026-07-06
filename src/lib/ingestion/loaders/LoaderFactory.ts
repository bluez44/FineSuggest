import { fileTypeFromBuffer } from 'file-type';
import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import { PdfLoader } from '@/lib/ingestion/loaders/PdfLoader';
import { DocxLoader } from '@/lib/ingestion/loaders/DocxLoader';
import { TextLoader } from '@/lib/ingestion/loaders/TextLoader';
import { UrlLoader } from '@/lib/ingestion/loaders/UrlLoader';
import { IngestionError, type LoaderInput } from '@/lib/ingestion/types';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class LoaderFactory {
  async forInput(input: LoaderInput): Promise<DocumentLoader> {
    if (input.kind === 'url') return new UrlLoader();

    // Extension override for markdown (file-type doesn't detect .md — it's plain text).
    if (input.filename.toLowerCase().endsWith('.md')) return new TextLoader();

    // Sniff by magic bytes; fall back to caller-provided mimeType.
    const sniffed = await fileTypeFromBuffer(new Uint8Array(input.buffer));
    const mime = sniffed?.mime ?? input.mimeType;

    if (mime === PDF_MIME) return new PdfLoader();
    if (mime === DOCX_MIME) return new DocxLoader();
    if (mime === 'text/plain' || mime.startsWith('text/')) return new TextLoader();

    throw new IngestionError(`Unsupported source type: ${mime}`, 'load');
  }
}
