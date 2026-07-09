'use client';

import type { Citation } from '@/lib/rag/citations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  citation: Citation | null;
  onClose: () => void;
}

function labelParts(c: Citation): string {
  return [c.dieu, c.khoan, c.diem].filter((p): p is string => Boolean(p)).join(', ');
}

export function CitationPreviewModal({ citation, onClose }: Props) {
  const open = citation !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trích dẫn nguồn</DialogTitle>
          <DialogDescription>
            {citation ? (
              <span className="text-slate-700">
                {labelParts(citation)}
                {citation.documentTitle ? ` — ${citation.documentTitle}` : ''}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-800">
          {citation?.snippet}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
