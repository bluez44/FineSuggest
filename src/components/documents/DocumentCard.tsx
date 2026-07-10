import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Globe, Trash2, Calendar } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

export interface DocumentRow {
  id: string;
  title: string;
  source_type: 'pdf' | 'docx' | 'txt' | 'md' | 'url';
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error_message: string | null;
  visibility: 'public' | 'private';
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

const ICON = { url: Globe, pdf: FileText, docx: FileText, txt: FileText, md: FileText };

export function DocumentCard({ doc, onDelete }: { doc: DocumentRow; onDelete: (id: string) => void }) {
  const Icon = ICON[doc.source_type];
  const dateStr = new Date(doc.created_at).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="glass-card hover:bg-white/[0.05] border-white/[0.08] hover:border-white/15 transition-all duration-300 shadow-md group rounded-xl overflow-hidden flex flex-col justify-between h-[135px]">
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2 space-y-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={cn(
            'p-2 rounded-lg border shrink-0',
            doc.source_type === 'url'
              ? 'bg-accent/10 border-accent/20 text-accent'
              : 'bg-primary/10 border-primary/20 text-primary'
          )}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-tight text-foreground truncate group-hover:text-primary transition-colors pr-2">
              {doc.title}
            </CardTitle>
            <span className="text-[10px] text-muted-foreground/80 font-mono uppercase tracking-wider block mt-1">
              {doc.source_type} · {doc.visibility === 'public' ? 'Hệ thống' : 'Cá nhân'}
            </span>
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          <StatusBadge status={doc.status} />
        </div>
      </CardHeader>

      <CardContent className="flex items-center justify-between text-xs text-muted-foreground/80 px-4 py-3 bg-white/[0.01] border-t border-white/[0.04]">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>{dateStr}</span>
        </span>
        {doc.visibility === 'private' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(doc.id)}
            aria-label="Xóa tài liệu"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg active:scale-95 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>

      {doc.status === 'failed' && doc.error_message && (
        <div className="px-4 pb-3 pt-0 text-[11px] text-red-400 font-medium">
          Lỗi: {doc.error_message}
        </div>
      )}
    </Card>
  );
}
