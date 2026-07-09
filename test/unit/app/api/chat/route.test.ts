// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_CONV_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Hoisted mocks. These modules are dynamically imported by the route.
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
  })),
}));

const mockConsume = vi.fn();
const mockOwnedBy = vi.fn();
const mockCreate = vi.fn();
const mockAppend = vi.fn();
const mockDeleteMessage = vi.fn();
const mockGetRecent = vi.fn();
const mockEmbed = vi.fn();
const mockRetrieve = vi.fn();
const mockStreamText = vi.fn();

vi.mock('@/lib/services/QuotaService', () => ({
  DAILY_QUESTION_LIMIT: 50,
  QuotaService: vi.fn().mockImplementation(function () { return { consumeQuestion: mockConsume }; }),
}));
vi.mock('@/lib/services/ConversationService', () => ({
  ConversationService: vi.fn().mockImplementation(function () {
    return {
      ownedBy: mockOwnedBy,
      create: mockCreate,
      appendMessage: mockAppend,
      deleteMessage: mockDeleteMessage,
      getRecentMessages: mockGetRecent,
    };
  }),
}));
vi.mock('@/lib/ingestion/embedder/GeminiEmbedder', () => ({
  GeminiEmbedder: vi.fn().mockImplementation(function () { return { embedBatch: mockEmbed }; }),
}));
vi.mock('@/lib/rag/retrieve', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/rag/retrieve');
  return { ...actual, retrieveChunks: (...args: unknown[]) => mockRetrieve(...args) };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('@/lib/env', () => ({
  serverEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-key',
  },
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  },
}));
vi.mock('ai', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('ai');
  return { ...actual, streamText: (...args: unknown[]) => mockStreamText(...args) };
});

let mockUser: { id: string } | null = { id: 'u-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 'u-1' };
  mockOwnedBy.mockResolvedValue(true);
  mockCreate.mockResolvedValue({ id: 'c-new', title: 'Cuộc trò chuyện mới' });
  mockAppend.mockResolvedValue({ id: 'm-1' });
  mockDeleteMessage.mockResolvedValue(undefined);
  mockGetRecent.mockResolvedValue([]);
});

async function callRoute(body: unknown) {
  const { POST } = await import('@/app/api/chat/route');
  return POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// Vercel AI SDK v7 UIMessage shape: role + parts array (no flat `content`).
function userMsg(text: string) {
  return { role: 'user' as const, parts: [{ type: 'text', text }] };
}

describe('POST /api/chat', () => {
  it('returns 401 when no session', async () => {
    mockUser = null;
    const res = await callRoute({ messages: [userMsg('q')], data: { conversationId: TEST_CONV_ID } });
    expect(res.status).toBe(401);
  });

  it('returns 429 when quota exceeded', async () => {
    mockConsume.mockResolvedValue({ ok: false, reason: 'quota' });
    const res = await callRoute({ messages: [userMsg('q')], data: { conversationId: TEST_CONV_ID } });
    expect(res.status).toBe(429);
  });

  it('returns 403 when conversationId is provided but not owned', async () => {
    mockOwnedBy.mockResolvedValue(false);
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    const res = await callRoute({ messages: [userMsg('q')], data: { conversationId: TEST_CONV_ID } });
    expect(res.status).toBe(403);
  });

  it('returns 400 when the last user message is empty or too long', async () => {
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    const long = 'x'.repeat(2001);
    const res = await callRoute({ messages: [userMsg(long)], data: { conversationId: TEST_CONV_ID } });
    expect(res.status).toBe(400);
  });

  it('rolls back the user message when embedding fails', async () => {
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    mockEmbed.mockRejectedValue(new Error('gemini boom'));
    mockAppend.mockResolvedValueOnce({ id: 'm-user' });
    const res = await callRoute({ messages: [userMsg('q')], data: { conversationId: TEST_CONV_ID } });
    expect(res.status).toBe(500);
    expect(mockDeleteMessage).toHaveBeenCalledWith('m-user');
  });

  it('short-circuits with fallback message when retrieval is empty', async () => {
    mockConsume.mockResolvedValue({ ok: true, remaining: 49 });
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);
    mockRetrieve.mockResolvedValue([]);
    mockAppend.mockResolvedValueOnce({ id: 'm-user' }).mockResolvedValueOnce({ id: 'm-assistant' });
    const res = await callRoute({ messages: [userMsg('q')], data: { conversationId: TEST_CONV_ID } });
    expect(res.status).toBe(200);
    // Second call is the fallback assistant persist.
    const secondCall = mockAppend.mock.calls[1]!;
    expect(secondCall[1]).toBe('assistant');
    expect(String(secondCall[2])).toMatch(/không tìm thấy/i);
    expect(mockStreamText).not.toHaveBeenCalled();
  });
});
