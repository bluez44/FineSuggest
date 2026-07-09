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

export interface SessionDocument {
  title: string;
  visibility: 'private' | 'public';
}

function labelParts(c: ChunkForPrompt): string {
  return [c.dieu, c.khoan, c.diem, c.documentTitle]
    .filter((p): p is string => p !== null && p !== undefined && p.length > 0)
    .join(', ');
}

function formatChunk(n: number, c: ChunkForPrompt): string {
  return `[${n}] (${labelParts(c)}) ${c.content}`;
}

function formatSessionInfo(sessionDocs: SessionDocument[]): string {
  const privateDocs = sessionDocs.filter((d) => d.visibility === 'private');
  const publicDocs = sessionDocs.filter((d) => d.visibility === 'public');

  const line = (label: string, docs: SessionDocument[]) =>
    docs.length === 0
      ? `${label}: (chưa có)`
      : `${label}:\n${docs.map((d) => `- ${d.title}`).join('\n')}`;

  return [
    line('Tài liệu người dùng đã tải lên', privateDocs),
    line('Tài liệu công khai của hệ thống', publicDocs),
  ].join('\n\n');
}

export function buildChatMessages(
  retrieved: ChunkForPrompt[],
  history: HistoryMessage[],
  question: string,
  sessionDocs: SessionDocument[] = [],
): { system: string; messages: ModelMessage[] } {
  const contextBody =
    retrieved.length === 0
      ? '(không có đoạn trích liên quan)'
      : retrieved.map((c, i) => formatChunk(i + 1, c)).join('\n\n');

  const system = [
    strictRagSystemPrompt,
    `SESSION INFO:\n${formatSessionInfo(sessionDocs)}`,
    `CONTEXT:\n${contextBody}`,
  ].join('\n\n');

  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ];

  return { system, messages };
}
