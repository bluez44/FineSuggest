import type { ModelMessage } from 'ai';
import { strictRagSystemPrompt } from './systemPrompt';
import type { RetrievedChunk } from './retrieve';

export type ChunkForPrompt = Pick<
  RetrievedChunk,
  'content' | 'dieu' | 'khoan' | 'diem' | 'documentTitle'
>;

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function labelParts(c: ChunkForPrompt): string {
  return [c.dieu, c.khoan, c.diem, c.documentTitle]
    .filter((p): p is string => p !== null && p !== undefined && p.length > 0)
    .join(', ');
}

function formatChunk(n: number, c: ChunkForPrompt): string {
  return `[${n}] (${labelParts(c)}) ${c.content}`;
}

export function buildChatMessages(
  retrieved: ChunkForPrompt[],
  history: HistoryMessage[],
  question: string,
): { system: string; messages: ModelMessage[] } {
  const contextBody = retrieved.map((c, i) => formatChunk(i + 1, c)).join('\n\n');
  const system = `${strictRagSystemPrompt}\n\nCONTEXT:\n${contextBody}`;

  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ];

  return { system, messages };
}
