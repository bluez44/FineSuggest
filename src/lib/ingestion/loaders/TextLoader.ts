import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import { IngestionError, type LoaderInput, type RawDoc, type SourceType } from '@/lib/ingestion/types';

export class TextLoader implements DocumentLoader {
  async load(input: LoaderInput): Promise<RawDoc> {
    if (input.kind !== 'buffer') {
      throw new IngestionError('TextLoader only accepts buffer input', 'load');
    }

    const raw = input.buffer.toString('utf8');
    const normalized = normalize(raw);
    const sourceType: SourceType = detectSourceType(input.filename, input.mimeType);
    const content = sourceType === 'md' ? stripMarkdown(normalized) : normalized;

    return {
      content,
      metadata: { sourceType, title: input.filename },
    };
  }
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function detectSourceType(filename: string, mimeType: string): SourceType {
  if (mimeType === 'text/markdown' || filename.toLowerCase().endsWith('.md')) return 'md';
  return 'txt';
}

/** Minimal markdown strip: headings, bold/italic markers, list bullets, links. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')                       // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')                   // bold
    .replace(/\*(.+?)\*/g, '$1')                       // italic
    .replace(/^[-*+]\s+/gm, '')                        // list bullets
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')           // [text](url) → text
    .replace(/`([^`]+)`/g, '$1');                      // inline code
}
