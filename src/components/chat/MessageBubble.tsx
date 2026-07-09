'use client';

import { Fragment, useState } from 'react';
import type { UIMessage } from 'ai';
import type { Citation } from '@/lib/rag/citations';
import { CitationPill } from './CitationPill';
import { CitationPreviewModal } from './CitationPreviewModal';

interface Props {
  message: UIMessage;
  citations: Citation[];
}

const MARKER_RE = /(\[\d+\])/g;

function renderTextWithMarkers(text: string) {
  const segments = text.split(MARKER_RE);
  return segments.map((seg, i) =>
    MARKER_RE.test(seg) ? (
      <span key={i} className="rounded bg-amber-100 px-1 text-amber-900">
        {seg}
      </span>
    ) : (
      <Fragment key={i}>{seg}</Fragment>
    ),
  );
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
  const bubbleClass = isUser
    ? 'ml-auto bg-slate-900 text-white'
    : 'mr-auto bg-white text-slate-900 border border-slate-200';

  return (
    <div className="flex flex-col">
      <div className={`max-w-2xl rounded-lg px-4 py-3 whitespace-pre-wrap ${bubbleClass}`}>
        {renderTextWithMarkers(messageText(message))}
      </div>
      {!isUser && citations.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {citations.map((c) => (
            <CitationPill key={c.chunkId + c.markerIndex} citation={c} onSelect={setSelected} />
          ))}
        </div>
      ) : null}
      <CitationPreviewModal citation={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
