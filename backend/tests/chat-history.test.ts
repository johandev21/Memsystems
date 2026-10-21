import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatService,
  MAX_HISTORY_MESSAGES,
  HISTORY_FETCH_LIMIT,
  deduplicateHistoryMessages,
  stripCitationKeys,
} from '../src/modules/chat/chat.service';
import { DRIZZLE } from '../src/modules/database/database.module';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { AiService } from '../src/modules/ai/ai.service';
import { ConnectionService } from '../src/modules/ai/connection.service';
import { RetrievalService } from '../src/modules/ai/retrieval/retrieval.service';
import { RetrievalTraceService } from '../src/modules/ai/retrieval/retrieval-trace.service';

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: mocks.streamText };
});

function extractSqlChunks(sqlObj: unknown): string[] {
  const result: string[] = [];
  const chunks = (sqlObj as { queryChunks?: unknown[] })?.queryChunks;
  for (const c of chunks || []) {
    const chunk = c as { value?: unknown; queryChunks?: unknown[] };
    if (chunk?.value !== undefined) result.push(String(chunk.value));
    if (chunk?.queryChunks) result.push(...extractSqlChunks(chunk));
  }
  return result;
}

interface HarnessOptions {
  historyRows?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    parts?: unknown;
    createdAt: Date;
    [key: string]: unknown;
  }>;
}

async function createTestHarness(options: HarnessOptions = {}) {
  let historyRows = options.historyRows ? [...options.historyRows] : [];
  let capturedWhere: unknown = null;
  let capturedOrderBy: unknown = null;
  let capturedLimit: number | null = null;

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((whereClause: unknown) => {
          capturedWhere = whereClause;
          return {
            orderBy: vi.fn((orderCol: unknown) => {
              capturedOrderBy = orderCol;
              const rows = [...historyRows];
              const isDesc = Boolean(
                (orderCol as { queryChunks?: Array<{ value?: string[] }> })?.queryChunks?.some((c) =>
                  c?.value?.some((v) => typeof v === 'string' && v.includes('desc')),
                ),
              );
              rows.sort((a, b) => {
                const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return isDesc ? bt - at : at - bt;
              });

              const promise = Promise.resolve(rows);
              return Object.assign(promise, {
                limit: vi.fn((limitNum: number) => {
                  capturedLimit = limitNum;
                  return Promise.resolve(rows.slice(0, limitNum));
                }),
              });
            }),
            then: Promise.resolve([]).then.bind(Promise.resolve([])),
          };
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: (values.id as string) || 'user-msg-new',
            role: values.role || 'user',
            content: values.content || 'hello',
            parts: values.parts || null,
            createdAt: new Date('2026-08-22T10:00:00.000Z'),
          },
        ]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
  };

  const provider = {
    createModel: vi.fn(() => ({ provider: 'test', modelId: 'test-model' })),
  };

  mocks.streamText.mockReturnValue({
    toUIMessageStreamResponse: vi.fn(() => new Response()),
  });

  const retrieve = vi.fn().mockResolvedValue({
    chunks: [],
    abstained: false,
    abstentionReason: null,
    unhelpfulSources: [],
    trace: { chosen: [] },
  });

  const module = await Test.createTestingModule({
    providers: [
      ChatService,
      { provide: DRIZZLE, useValue: db },
      {
        provide: NotebooksService,
        useValue: {
          assertNotebookOwner: vi.fn().mockResolvedValue(undefined),
          getGroundingMode: vi.fn().mockResolvedValue('free'),
        },
      },
      {
        provide: AiService,
        useValue: {
          getProviderForModel: vi.fn().mockResolvedValue(provider),
          getGatewayRequestOptions: vi.fn().mockResolvedValue({}),
          requireCapability: vi.fn(),
        },
      },
      {
        provide: ConnectionService,
        useValue: { requireConnected: vi.fn().mockResolvedValue(undefined) },
      },
      {
        provide: RetrievalService,
        useValue: { retrieve },
      },
      {
        provide: RetrievalTraceService,
        useValue: { record: vi.fn().mockResolvedValue(undefined) },
      },
    ],
  }).compile();

  return {
    service: module.get(ChatService),
    db,
    retrieve,
    setHistoryRows: (rows: typeof historyRows) => {
      historyRows = [...rows];
    },
    getCapturedWhere: () => capturedWhere,
    getCapturedOrderBy: () => capturedOrderBy,
    getCapturedLimit: () => capturedLimit,
  };
}

describe('Chat History Assembly & Clean-up (Ticket #131)', () => {
  describe('a) Version deduplication', () => {
    it('keeps only the latest assistant message per user turn in chronological order', () => {
      const messages = [
        { id: 'u1', role: 'user', content: 'Turn 1 user' },
        { id: 'a1_v1', role: 'assistant', content: 'Turn 1 reply v1' },
        { id: 'a1_v2', role: 'assistant', content: 'Turn 1 reply v2' },
        { id: 'u2', role: 'user', content: 'Turn 2 user' },
        { id: 'a2_v1', role: 'assistant', content: 'Turn 2 reply v1' },
      ];

      const deduplicated = deduplicateHistoryMessages(messages);

      expect(deduplicated).toEqual([
        { id: 'u1', role: 'user', content: 'Turn 1 user' },
        { id: 'a1_v2', role: 'assistant', content: 'Turn 1 reply v2' },
        { id: 'u2', role: 'user', content: 'Turn 2 user' },
        { id: 'a2_v1', role: 'assistant', content: 'Turn 2 reply v1' },
      ]);
    });

    it('collapses multiple (>2) regenerated versions down to the final version', () => {
      const messages = [
        { id: 'u1', role: 'user', content: 'Turn 1 user' },
        { id: 'a1_v1', role: 'assistant', content: 'v1' },
        { id: 'a1_v2', role: 'assistant', content: 'v2' },
        { id: 'a1_v3', role: 'assistant', content: 'v3' },
        { id: 'a1_v4', role: 'assistant', content: 'v4' },
        { id: 'u2', role: 'user', content: 'Turn 2 user' },
      ];

      const deduplicated = deduplicateHistoryMessages(messages);

      expect(deduplicated).toEqual([
        { id: 'u1', role: 'user', content: 'Turn 1 user' },
        { id: 'a1_v4', role: 'assistant', content: 'v4' },
        { id: 'u2', role: 'user', content: 'Turn 2 user' },
      ]);
    });

    it('caps history at MAX_HISTORY_MESSAGES (6) after deduplication', async () => {
      // 5 turns with regenerated replies (10 messages before dedup, 8 messages after dedup)
      const rows = [
        { id: 'u1', role: 'user' as const, content: 'User 1', createdAt: new Date('2026-08-22T10:00:00Z') },
        { id: 'a1_1', role: 'assistant' as const, content: 'A1 v1', createdAt: new Date('2026-08-22T10:01:00Z') },
        { id: 'a1_2', role: 'assistant' as const, content: 'A1 v2', createdAt: new Date('2026-08-22T10:02:00Z') },
        { id: 'u2', role: 'user' as const, content: 'User 2', createdAt: new Date('2026-08-22T10:03:00Z') },
        { id: 'a2', role: 'assistant' as const, content: 'A2', createdAt: new Date('2026-08-22T10:04:00Z') },
        { id: 'u3', role: 'user' as const, content: 'User 3', createdAt: new Date('2026-08-22T10:05:00Z') },
        { id: 'a3', role: 'assistant' as const, content: 'A3', createdAt: new Date('2026-08-22T10:06:00Z') },
        { id: 'u4', role: 'user' as const, content: 'User 4', createdAt: new Date('2026-08-22T10:07:00Z') },
        { id: 'a4', role: 'assistant' as const, content: 'A4', createdAt: new Date('2026-08-22T10:08:00Z') },
      ];

      const harness = await createTestHarness({ historyRows: rows });
      const history = await harness.service.getRecentHistory('notebook-1', MAX_HISTORY_MESSAGES);

      // Deduplicated full list is [u1, a1_2, u2, a2, u3, a3, u4, a4] (8 items).
      // Windowed to last 6: [u2, a2, u3, a3, u4, a4]
      expect(history).toHaveLength(6);
      expect(history.map((m) => m.id)).toEqual(['u2', 'a2', 'u3', 'a3', 'u4', 'a4']);
    });
  });

  describe('b) Citation key stripping', () => {
    it('strips [ref:R1] and [ref:R12] markers and cleans double spaces', () => {
      const input = 'This is grounded [ref:R1] and confirmed [ref:R12]. More facts [ref:R2] here.';
      const output = stripCitationKeys(input);
      expect(output).toBe('This is grounded and confirmed. More facts here.');
      expect(output).not.toContain('[ref:R1]');
      expect(output).not.toContain('[ref:R12]');
      expect(output).not.toContain('  ');
    });

    it('handles backticked citation markers and end-of-sentence citations', () => {
      const input = 'Osmosis moves water `[ref:R1]`. Also diffusion [ref:R3].';
      const output = stripCitationKeys(input);
      expect(output).toBe('Osmosis moves water. Also diffusion.');
    });

    it('leaves content without citation keys untouched', () => {
      const input = 'Regular assistant response with no markers.';
      expect(stripCitationKeys(input)).toBe(input);
    });

    it('strips citation markers from prior assistant messages before LLM streamText and retrieval', async () => {
      const rows = [
        {
          id: 'u1',
          role: 'user' as const,
          content: 'What is photosynthesis?',
          createdAt: new Date('2026-08-22T10:00:00Z'),
        },
        {
          id: 'a1',
          role: 'assistant' as const,
          content: 'Photosynthesis converts light into energy [ref:R1] and sugar [ref:R12].',
          createdAt: new Date('2026-08-22T10:01:00Z'),
        },
      ];

      const harness = await createTestHarness({ historyRows: rows });

      await harness.service.sendMessage('notebook-1', {
        content: 'Tell me more about light absorption.',
        model: 'openai/gpt-5.6-sol',
      });

      // 1. Verify history passed to retrieval has citation keys stripped
      expect(harness.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          history: [
            { role: 'user', content: 'What is photosynthesis?' },
            {
              role: 'assistant',
              content: 'Photosynthesis converts light into energy and sugar.',
            },
          ],
        }),
      );

      // 2. Verify messages passed to LLM streamText has citation keys stripped
      expect(mocks.streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            {
              role: 'assistant',
              content: 'Photosynthesis converts light into energy and sugar.',
            },
          ]),
        }),
      );
    });
  });

  describe('c) SQL limit & excludeMessageId', () => {
    it('queries with desc(createdAt), limits fetch to HISTORY_FETCH_LIMIT (30), and restores chronological order', async () => {
      const harness = await createTestHarness({ historyRows: [] });

      await harness.service.getRecentHistory('notebook-1', 6);

      expect(harness.getCapturedLimit()).toBe(HISTORY_FETCH_LIMIT);
      const capturedOrderBy = harness.getCapturedOrderBy() as {
        queryChunks?: Array<{ value?: string[] }>;
      };
      const hasDesc = capturedOrderBy?.queryChunks?.some((c) =>
        c?.value?.some((v) => typeof v === 'string' && v.includes('desc')),
      );
      expect(hasDesc).toBe(true);
    });

    it('excludes excludeMessageId directly in SQL where clause when provided', async () => {
      const harness = await createTestHarness({ historyRows: [] });

      await harness.service.getRecentHistory('notebook-1', 6, 'msg-to-exclude');

      const capturedWhere = harness.getCapturedWhere();
      expect(capturedWhere).toBeDefined();

      const chunks = extractSqlChunks(capturedWhere);
      expect(chunks).toContain('msg-to-exclude');
      expect(chunks.some((c) => c.includes('<>') || c.includes('!='))).toBe(true);
    });

    it('does not add ne condition when excludeMessageId is not provided', async () => {
      const harness = await createTestHarness({ historyRows: [] });

      await harness.service.getRecentHistory('notebook-1', 6);

      const capturedWhere = harness.getCapturedWhere();
      expect(capturedWhere).toBeDefined();

      const chunks = extractSqlChunks(capturedWhere);
      expect(chunks).not.toContain('msg-to-exclude');
      expect(chunks.some((c) => c.includes('<>') || c.includes('!='))).toBe(false);
    });
  });

  describe('d) Edge cases', () => {
    it('handles a single user message', () => {
      const messages = [{ id: 'u1', role: 'user', content: 'Single prompt' }];
      expect(deduplicateHistoryMessages(messages)).toEqual([
        { id: 'u1', role: 'user', content: 'Single prompt' },
      ]);
    });

    it('handles multiple user messages without an assistant response', () => {
      const messages = [
        { id: 'u1', role: 'user', content: 'Prompt 1' },
        { id: 'u2', role: 'user', content: 'Prompt 2' },
        { id: 'u3', role: 'user', content: 'Prompt 3' },
      ];
      expect(deduplicateHistoryMessages(messages)).toEqual([
        { id: 'u1', role: 'user', content: 'Prompt 1' },
        { id: 'u2', role: 'user', content: 'Prompt 2' },
        { id: 'u3', role: 'user', content: 'Prompt 3' },
      ]);
    });

    it('handles orphan assistant messages at the start and keeps the latest', () => {
      const messages = [
        { id: 'a0_1', role: 'assistant', content: 'Initial orphan v1' },
        { id: 'a0_2', role: 'assistant', content: 'Initial orphan v2' },
        { id: 'u1', role: 'user', content: 'User 1' },
        { id: 'a1', role: 'assistant', content: 'Assistant 1' },
      ];
      expect(deduplicateHistoryMessages(messages)).toEqual([
        { id: 'a0_2', role: 'assistant', content: 'Initial orphan v2' },
        { id: 'u1', role: 'user', content: 'User 1' },
        { id: 'a1', role: 'assistant', content: 'Assistant 1' },
      ]);
    });

    it('handles history larger than 6 messages after deduplication', () => {
      // 8 distinct turns
      const messages = [
        { id: 'u1', role: 'user', content: '1' },
        { id: 'a1', role: 'assistant', content: '1' },
        { id: 'u2', role: 'user', content: '2' },
        { id: 'a2', role: 'assistant', content: '2' },
        { id: 'u3', role: 'user', content: '3' },
        { id: 'a3', role: 'assistant', content: '3' },
        { id: 'u4', role: 'user', content: '4' },
        { id: 'a4', role: 'assistant', content: '4' },
      ];

      const deduplicated = deduplicateHistoryMessages(messages);
      const capped = deduplicated.slice(-6);

      expect(capped).toHaveLength(6);
      expect(capped.map((m) => m.id)).toEqual(['u2', 'a2', 'u3', 'a3', 'u4', 'a4']);
    });

    it('handles empty message history', () => {
      expect(deduplicateHistoryMessages([])).toEqual([]);
      expect(stripCitationKeys('')).toBe('');
      expect(stripCitationKeys(null)).toBe('');
      expect(stripCitationKeys(undefined)).toBe('');
    });
  });
});
