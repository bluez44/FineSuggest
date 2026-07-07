'use client';

import { useState } from 'react';
import { DocumentList } from './DocumentList';
import { UploadDialog } from './UploadDialog';

export function DocumentsPageClient() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tài liệu</h1>
        <UploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
      </div>
      <DocumentList refreshKey={refreshKey} />
    </div>
  );
}
