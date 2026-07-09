'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface Props {
  activeId: string;
  initialConversations: Conversation[];
}

export function ConversationSidebar({ activeId, initialConversations }: Props) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [creating, setCreating] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => setConversations(initialConversations), [initialConversations]);

  async function handleNew() {
    setCreating(true);
    try {
      const res = await fetch('/api/conversations', { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const { id } = (await res.json()) as { id: string };
      router.push(`/chat/${id}`);
    } catch {
      toast.error('Không tạo được cuộc trò chuyện');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Xóa thất bại');
        return;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) router.push('/chat');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="flex h-full flex-col p-3">
      <Button className="mb-3" onClick={handleNew} disabled={creating}>
        + Cuộc trò chuyện mới
      </Button>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center justify-between rounded px-2 py-2 text-sm ${
              c.id === activeId ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Link href={`/chat/${c.id}`} className="flex-1 truncate">
              {c.title}
            </Link>
            <button
              onClick={() => handleDelete(c.id)}
              disabled={deletingIds.has(c.id)}
              className="ml-2 text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Xóa"
            >
              ×
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}
