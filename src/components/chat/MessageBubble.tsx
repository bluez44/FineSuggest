'use client';

import { Fragment, useState } from 'react';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { CitationPill } from './CitationPill';
import { CitationPreviewModal } from './CitationPreviewModal';
import { User, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  message: UIMessage;
  citations: Citation[];
}

const MARKER_RE = /(\[\d+\])/g;

function renderTextWithMarkers(text: string) {
  const segments = text.split(MARKER_RE);
  return segments.map((seg, i) => {
    // Check if the segment matches [number] format
    const isM = seg.startsWith('[') && seg.endsWith(']') && !isNaN(Number(seg.slice(1, -1)));
    return isM ? (
      <span
        key={i}
        className="inline-flex items-center justify-center rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent border border-accent/30 mx-0.5 cursor-help transition-all hover:bg-accent/35"
        title={`Nguồn trích dẫn số ${seg.slice(1, -1)}`}
      >
        {seg.slice(1, -1)}
      </span>
    ) : (
      <Fragment key={i}>{seg}</Fragment>
    );
  });
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function MessageBubble({ message, citations }: Props) {
  const [selected, setSelected] = useState<Citation | null>(null);
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-4 w-full items-start', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'h-9 w-9 rounded-xl flex items-center justify-center border shrink-0',
        isUser
          ? 'bg-primary/10 border-primary/20 text-primary'
          : 'bg-accent/10 border-accent/20 text-accent'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      </div>

      {/* Bubble Content */}
      <div className="flex-1 flex flex-col space-y-2 max-w-[85%]">
        <div className={cn(
          'rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-lg whitespace-pre-wrap',
          isUser
            ? 'ml-auto bg-gradient-to-r from-primary to-violet-600 text-primary-foreground shadow-primary/5 rounded-tr-none'
            : 'mr-auto glass-card border-white/[0.08] text-foreground rounded-tl-none'
        )}>
          {renderTextWithMarkers(messageText(message))}
        </div>

        {/* Citations section */}
        {!isUser && citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {citations.map((c) => (
              <CitationPill key={c.chunkId + c.markerIndex} citation={c} onSelect={setSelected} />
            ))}
          </div>
        )}
      </div>

      <CitationPreviewModal citation={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
