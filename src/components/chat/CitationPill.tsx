'use client';

import type { Citation } from '@/lib/rag/citations';

interface Props {
  citation: Citation;
  onSelect: (c: Citation) => void;
}

function shortLabel(c: Citation): string {
  const parts = [c.dieu, c.khoan, c.diem].filter((p): p is string => Boolean(p));
  const primary = parts.length > 0 ? parts.join(', ') : 'Nguồn';
  return `[${c.markerIndex}] ${primary}`;
}

export function CitationPill({ citation, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(citation)}
      className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:bg-slate-200"
      title={citation.documentTitle}
    >
      {shortLabel(citation)}
    </button>
  );
}
