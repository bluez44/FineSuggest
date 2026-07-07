'use client';

import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentCard, type DocumentRow } from './DocumentCard';

const POLL_INTERVAL = 3000;

export function DocumentList({ refreshKey }: { refreshKey: number }) {
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const res = await fetch('/api/documents');
        if (!res.ok) throw new Error(`GET failed: ${res.status}`);
        const json = (await res.json()) as { documents: DocumentRow[] };
        if (cancelled) return;
        setDocs(json.documents);
        setError(null);
        const inFlight = json.documents.some((d) => d.status === 'pending' || d.status === 'processing');
        if (inFlight && !cancelled) {
          timer.current = setTimeout(fetchOnce, POLL_INTERVAL);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    fetchOnce();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function onDelete(id: string) {
    if (!confirm('Xóa tài liệu này?')) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      setDocs((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } else {
      alert('Xóa thất bại');
    }
  }

  if (error) return <p className="text-sm text-destructive">Lỗi tải danh sách: {error}</p>;
  if (docs === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có tài liệu nào.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {docs.map((d) => (
        <DocumentCard key={d.id} doc={d} onDelete={onDelete} />
      ))}
    </div>
  );
}
