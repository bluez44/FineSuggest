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
import { BookOpen, FileText } from 'lucide-react';

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
      <DialogContent className="max-w-lg glass-card border border-white/[0.08] bg-popover/95 backdrop-blur-2xl rounded-2xl shadow-2xl p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <BookOpen className="h-5 w-5 text-accent" />
            <span>Trích dẫn nguồn</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1 font-medium">
            {citation ? (
              <span className="block border-l-2 border-accent pl-2.5">
                {labelParts(citation)}
                {citation.documentTitle ? ` — ${citation.documentTitle}` : ''}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {/* Text snippet container */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-foreground/90 leading-relaxed max-h-[300px] overflow-y-auto font-sans">
          <div className="absolute top-3 right-3 text-muted-foreground/30">
            <FileText className="h-5 w-5" />
          </div>
          <p className="whitespace-pre-wrap">{citation?.snippet}</p>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button onClick={onClose} variant="outline" className="border-white/10 hover:bg-white/5 bg-transparent rounded-xl px-5">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
