'use client';

import { useState } from 'react';
import { DocumentList } from './DocumentList';
import { UploadDialog } from './UploadDialog';
import { FileText } from 'lucide-react';

export function DocumentsPageClient() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 bg-transparent">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cơ sở dữ liệu RAG</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tài liệu của tôi</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý các tài liệu pháp lý giao thông để làm giàu ngữ cảnh trả lời của AI.
          </p>
        </div>
        <div className="shrink-0">
          <UploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
        </div>
      </div>

      <div className="pt-2">
        <DocumentList refreshKey={refreshKey} />
      </div>
    </div>
  );
}
