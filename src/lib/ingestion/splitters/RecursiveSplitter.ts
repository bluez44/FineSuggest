import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { ChunkSplitter } from '@/lib/ingestion/splitters/ChunkSplitter';
import type { Chunk, RawDoc } from '@/lib/ingestion/types';

export interface RecursiveSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export class RecursiveSplitter implements ChunkSplitter {
  private inner: RecursiveCharacterTextSplitter;

  constructor(opts: RecursiveSplitterOptions = {}) {
    this.inner = new RecursiveCharacterTextSplitter({
      chunkSize: opts.chunkSize ?? 800,
      chunkOverlap: opts.chunkOverlap ?? 150,
      separators: ['\n\n', '\n', '. ', '? ', '! ', ' ', ''],
    });
  }

  async split(doc: RawDoc): Promise<Chunk[]> {
    const strings = await this.inner.splitText(doc.content);
    const pageMap = doc.metadata.pageMap ?? [];
    let searchFrom = 0;

    return strings.map((content, ordinal) => {
      const start = doc.content.indexOf(content.slice(0, 40), searchFrom);
      searchFrom = start >= 0 ? start + 1 : searchFrom;
      const page = pageMap.find((p) => start >= p.start && start < p.end)?.page;
      return { content, ordinal, page };
    });
  }
}
