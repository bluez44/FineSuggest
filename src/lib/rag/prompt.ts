import type { ModelMessage } from 'ai';
import { strictRagSystemPrompt } from './systemPrompt';

// Structural type shared with retrieve.ts (declared here to avoid a hard
// import cycle; retrieve.ts declares the canonical RetrievedChunk).
export interface ChunkForPrompt {
  content: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
  documentTitle: string;
}

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
