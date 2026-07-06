import mammoth from 'mammoth';
import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import { IngestionError, type LoaderInput, type RawDoc } from '@/lib/ingestion/types';

export class DocxLoader implements DocumentLoader {
  async load(input: LoaderInput): Promise<RawDoc> {
    if (input.kind !== 'buffer') {
      throw new IngestionError('DocxLoader only accepts buffer input', 'load');
    }

    let result;
    try {
      result = await mammoth.extractRawText({ buffer: input.buffer });
    } catch (err) {
      throw new IngestionError('Failed to parse DOCX', 'load', err);
    }

    const content = result.value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    return {
      content,
      metadata: {
        sourceType: 'docx',
        title: input.filename,
      },
    };
  }
}
