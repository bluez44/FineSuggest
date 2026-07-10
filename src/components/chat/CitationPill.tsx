'use client';

import type { Citation } from '@/lib/rag/citations';
import { BookOpen } from 'lucide-react';

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
      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-white/15 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
      title={citation.documentTitle ?? undefined}
    >
      <BookOpen className="h-3 w-3 text-accent" />
      <span className="font-medium">{shortLabel(citation)}</span>
    </button>
  );
}
