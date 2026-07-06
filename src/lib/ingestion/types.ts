export type SourceType = 'pdf' | 'docx' | 'txt' | 'md' | 'url';

export interface RawDoc {
  /** Full extracted text, whitespace normalized. */
  content: string;
  metadata: {
    sourceType: SourceType;
    title: string;
    /** Optional page boundaries within `content`. Used by PdfLoader to attach `page` to chunks. */
    pageMap?: Array<{ page: number; start: number; end: number }>;
    /** Source-specific extras (e.g. original URL, PDF page count). */
    [key: string]: unknown;
  };
}

export interface Chunk {
  content: string;
  ordinal: number;
  dieu?: string;
  khoan?: string;
  diem?: string;
  page?: number;
  metadata?: Record<string, unknown>;
}

export type LoaderInput =
  | { kind: 'buffer'; buffer: Buffer; filename: string; mimeType: string }
  | { kind: 'url'; url: string };

export class IngestionError extends Error {
  override name = 'IngestionError';

  constructor(
    message: string,
    readonly stage: 'load' | 'split' | 'embed' | 'store',
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'IngestionError';
  }
}
