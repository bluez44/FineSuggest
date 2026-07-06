import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { ChunkSplitter } from '@/lib/ingestion/splitters/ChunkSplitter';
import type { Chunk, RawDoc } from '@/lib/ingestion/types';

export interface RecursiveSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export class RecursiveSplitter implements ChunkSplitter {
  private inner: RecursiveCharacterTextSplitter;
  private chunkOverlap: number;

  constructor(opts: RecursiveSplitterOptions = {}) {
    this.chunkOverlap = opts.chunkOverlap ?? 150;
    this.inner = new RecursiveCharacterTextSplitter({
      chunkSize: opts.chunkSize ?? 800,
      chunkOverlap: this.chunkOverlap,
      separators: ['\n\n', '\n', '. ', '? ', '! ', ' ', ''],
    });
  }

  async split(doc: RawDoc): Promise<Chunk[]> {
    const strings = await this.inner.splitText(doc.content);
    const pageMap = doc.metadata.pageMap ?? [];
    let searchFrom = 0;

    return strings.map((content, ordinal) => {
      const longProbe = content.slice(0, Math.min(80, content.length));
      let start = doc.content.indexOf(longProbe, searchFrom);
      if (start < 0) {
        const shortProbe = content.slice(0, Math.min(20, content.length));
        start = doc.content.indexOf(shortProbe, searchFrom);
      }

      let page: number | undefined;
      if (start >= 0) {
        page = pageMap.find((p) => start >= p.start && start < p.end)?.page;
        searchFrom = start + 1;
      } else {
        // Both probes failed. Advance conservatively so later chunks don't re-scan.
        const advance = Math.max(1, content.length - this.chunkOverlap);
        searchFrom = Math.min(searchFrom + advance, doc.content.length);
      }

      return { content, ordinal, page };
    });
  }
}
