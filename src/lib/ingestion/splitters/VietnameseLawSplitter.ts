import { RecursiveSplitter } from '@/lib/ingestion/splitters/RecursiveSplitter';
import type { ChunkSplitter } from '@/lib/ingestion/splitters/ChunkSplitter';
import type { Chunk, RawDoc } from '@/lib/ingestion/types';

export interface VietnameseLawSplitterOptions {
  maxDieuSize?: number;
  subChunkSize?: number;
  subChunkOverlap?: number;
}

// Matches "Điều 1.", "Điều 12.", "Điều 5:" at line start.
const DIEU_RE = /^Điều\s+(\d+)[.:]/m;
// Global for splitting: same as above but with the "g" and "m" flags.
const DIEU_SPLIT_RE = /(?=^Điều\s+\d+[.:])/gm;

export class VietnameseLawSplitter implements ChunkSplitter {
  // TODO(plan-3): current implementation emits one chunk per Điều but never populates
  // khoan/diem metadata. Per-Khoản (numbered clauses inside a Điều) and per-Điểm (lettered
  // sub-points) chunk-level metadata is needed for finer-grained RAG citations in Plan 3.
  // Approach: parse "^\d+\." and "^[a-z]\)" markers within each Điều body and emit sub-chunks
  // carrying dieu + khoan (+ diem) on each.

  private maxDieuSize: number;
  private sub: RecursiveSplitter;

  constructor(opts: VietnameseLawSplitterOptions = {}) {
    this.maxDieuSize = opts.maxDieuSize ?? 1500;
    this.sub = new RecursiveSplitter({
      chunkSize: opts.subChunkSize ?? 800,
      chunkOverlap: opts.subChunkOverlap ?? 150,
    });
  }

  async split(doc: RawDoc): Promise<Chunk[]> {
    const sections = doc.content.split(DIEU_SPLIT_RE).filter((s) => DIEU_RE.test(s));
    const chunks: Chunk[] = [];
    let ordinal = 0;

    for (const section of sections) {
      const dieuMatch = section.match(DIEU_RE);
      if (!dieuMatch) continue;
      const dieuLabel = `Điều ${dieuMatch[1]}`;
      const body = section.trim();

      if (body.length <= this.maxDieuSize) {
        chunks.push({ content: body, ordinal: ordinal++, dieu: dieuLabel });
        continue;
      }

      // Oversize Điều: fall back to recursive splitter, tagging every sub-chunk with dieu.
      const subDoc: RawDoc = {
        content: body,
        metadata: { sourceType: doc.metadata.sourceType, title: doc.metadata.title },
      };
      const subChunks = await this.sub.split(subDoc);
      for (const sub of subChunks) {
        chunks.push({ ...sub, ordinal: ordinal++, dieu: dieuLabel });
      }
    }

    return chunks;
  }
}
