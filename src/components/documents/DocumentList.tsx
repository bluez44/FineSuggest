'use client';

import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentCard, type DocumentRow } from './DocumentCard';
import { FolderOpen } from 'lucide-react';

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

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Lỗi tải danh sách tài liệu: {error}
      </div>
    );
  }

  if (docs === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-[60%] rounded-md bg-white/5" />
              <Skeleton className="h-5 w-[20%] rounded-md bg-white/5" />
            </div>
            <Skeleton className="h-4 w-[40%] rounded-md bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl p-12 text-center space-y-4 bg-white/[0.01]">
        <div className="p-4 rounded-full bg-white/5 text-muted-foreground/60">
          <FolderOpen className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Không tìm thấy tài liệu</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Hệ thống chưa có tài liệu cá nhân nào. Hãy thêm tài liệu bằng nút phía trên.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {docs.map((d) => (
        <DocumentCard key={d.id} doc={d} onDelete={onDelete} />
      ))}
    </div>
  );
}
