'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const [prevInitialConversations, setPrevInitialConversations] = useState(initialConversations);
  if (initialConversations !== prevInitialConversations) {
    setConversations(initialConversations);
    setPrevInitialConversations(initialConversations);
  }

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
    <div className="flex h-full flex-col p-4">
      {/* Create new chat button */}
      <Button
        onClick={handleNew}
        disabled={creating}
        className="mb-4 w-full h-11 bg-gradient-to-r from-primary to-violet-600 text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-95 shadow-md shadow-primary/10 transition-all active:scale-[0.98]"
      >
        <Plus className="h-4.5 w-4.5" />
        <span>Cuộc trò chuyện mới</span>
      </Button>

      {/* Conversations list */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {conversations.map((c) => {
          const isActive = c.id === activeId;
          const isDeleting = deletingIds.has(c.id);

          return (
            <div
              key={c.id}
              className={cn(
                'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                isActive
                  ? 'bg-white/10 text-foreground border-l-2 border-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              )}
            >
              <Link
                href={`/chat/${c.id}`}
                className="flex-1 truncate flex items-center gap-2"
              >
                <MessageSquare className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/60')} />
                <span className="truncate">{c.title}</span>
              </Link>
              
              <button
                onClick={() => handleDelete(c.id)}
                disabled={isDeleting}
                className={cn(
                  'ml-2 p-1.5 rounded-lg text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150',
                  isDeleting && 'cursor-not-allowed opacity-50'
                )}
                aria-label="Xóa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
