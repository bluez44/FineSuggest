import type { ChunkSplitter } from '@/lib/ingestion/splitters/ChunkSplitter';
import { VietnameseLawSplitter } from '@/lib/ingestion/splitters/VietnameseLawSplitter';
import { RecursiveSplitter } from '@/lib/ingestion/splitters/RecursiveSplitter';
import type { RawDoc } from '@/lib/ingestion/types';

const DIEU_COUNT_RE = /^Điều\s+\d+[.:]/gm;

export class SplitterFactory {
  forDoc(doc: RawDoc): ChunkSplitter {
    const matches = doc.content.match(DIEU_COUNT_RE);
    if (matches && matches.length >= 2) return new VietnameseLawSplitter();
    return new RecursiveSplitter();
  }
}
