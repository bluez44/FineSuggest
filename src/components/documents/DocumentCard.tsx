import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Globe, Trash2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

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
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-start gap-2">
          <Icon className="mt-1 h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base leading-tight">{doc.title}</CardTitle>
        </div>
        <StatusBadge status={doc.status} />
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {doc.source_type.toUpperCase()} · {doc.visibility === 'public' ? 'Chung' : 'Riêng'}
        </span>
        {doc.visibility === 'private' && (
          <Button variant="ghost" size="sm" onClick={() => onDelete(doc.id)} aria-label="Xóa">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
      {doc.status === 'failed' && doc.error_message && (
        <CardContent className="pt-0 text-xs text-destructive">{doc.error_message}</CardContent>
      )}
    </Card>
  );
}
