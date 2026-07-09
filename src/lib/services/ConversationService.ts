import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { Citation } from '@/lib/rag/citations';
import type { HistoryMessage } from '@/lib/rag/prompt';

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: string;
}

export class ConversationService {
  constructor(private client: SupabaseClient<Database>) {}

  async list(userId: string): Promise<ConversationSummary[]> {
    const { data, error } = await this.client
      .from('conversations')
      .select('id, title, updated_at')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`list conversations failed: ${error.message}`);
    return (data ?? []).map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
  }

  async create(userId: string): Promise<{ id: string; title: string }> {
    const { data, error } = await this.client
      .from('conversations')
      .insert({ owner_id: userId })
      .select('id, title')
      .single();
    if (error || !data) throw new Error(`create conversation failed: ${error?.message ?? 'no data'}`);
    return { id: data.id, title: data.title };
  }

  async rename(id: string, userId: string, title: string): Promise<void> {
    const { data, error } = await this.client
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', userId)
      .select('id');
    if (error) throw new Error(`rename failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('conversation not found or not owned');
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId);
    if (error) throw new Error(`delete failed: ${error.message}`);
  }

  async getMessages(id: string, userId: string): Promise<StoredMessage[]> {
    const owned = await this.ownedBy(id, userId);
    if (!owned) throw new Error('conversation not found or not owned');
    const { data, error } = await this.client
      .from('messages')
      .select('id, role, content, citations, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`get messages failed: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      citations: (r.citations as unknown as Citation[]) ?? [],
      createdAt: r.created_at,
    }));
  }

  async getRecentMessages(id: string, limit: number): Promise<HistoryMessage[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`get recent messages failed: ${error.message}`);
    // DB returns newest→oldest; reverse for oldest→newest prompt order.
    return (data ?? [])
      .slice()
      .reverse()
      .map((r) => ({ role: r.role, content: r.content }));
  }

  async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    citations?: Citation[],
  ): Promise<{ id: string }> {
    const payload: {
      conversation_id: string;
      role: 'user' | 'assistant';
      content: string;
      citations?: Json;
    } = { conversation_id: conversationId, role, content };
    if (citations && citations.length > 0) payload.citations = citations as unknown as Json;

    const { data, error } = await this.client
      .from('messages')
      .insert(payload)
      .select('id')
      .single();
    if (error || !data) throw new Error(`append message failed: ${error?.message ?? 'no data'}`);
    return { id: data.id };
  }

  async deleteMessage(id: string): Promise<void> {
    const { error } = await this.client.from('messages').delete().eq('id', id);
    if (error) throw new Error(`delete message failed: ${error.message}`);
  }

  async ownedBy(id: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw new Error(`ownership check failed: ${error.message}`);
    return data !== null;
  }
}
