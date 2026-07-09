export interface CitationSourceChunk {
  id: string;
  documentId: string;
  content: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  page: number | null;
  documentTitle: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  page: number | null;
  documentTitle: string;
  snippet: string;
  markerIndex: number;
}

const MARKER_RE = /\[(\d+)\]/g;
const SNIPPET_MAX = 300;

function truncateSnippet(content: string): string {
  if (content.length <= SNIPPET_MAX) return content;
  const raw = content.slice(0, SNIPPET_MAX);
  const lastSpace = raw.lastIndexOf(' ');
  return lastSpace > SNIPPET_MAX - 60 ? raw.slice(0, lastSpace) : raw;
}

export function parseCitations(
  assistantText: string,
  retrieved: CitationSourceChunk[],
): Citation[] {
  if (!assistantText) return [];
  const seen = new Set<number>();
  const out: Citation[] = [];
  for (const match of assistantText.matchAll(MARKER_RE)) {
    const captured = match[1];
    if (!captured) continue;
    const n = Number.parseInt(captured, 10);
    if (seen.has(n)) continue;
    const source = retrieved[n - 1];
    if (!source) continue;
    seen.add(n);
    out.push({
      chunkId: source.id,
      documentId: source.documentId,
      dieu: source.dieu,
      khoan: source.khoan,
      diem: source.diem,
      page: source.page,
      documentTitle: source.documentTitle,
      snippet: truncateSnippet(source.content),
      markerIndex: n,
    });
  }
  return out;
}
