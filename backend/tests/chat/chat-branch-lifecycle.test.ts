import { Test, type TestingModule } from '@nestjs/testing';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/database/schema';
import {
  ChatService,
  type SendInput,
} from '../../src/modules/chat/chat.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { ConnectionService } from '../../src/modules/ai/connection.service';
import { RetrievalService } from '../../src/modules/ai/retrieval/retrieval.service';
import { RetrievalTraceService } from '../../src/modules/ai/retrieval/retrieval-trace.service';
import { DRIZZLE } from '../../src/modules/database/database.module';
import { NotebooksService } from '../../src/modules/notebooks/notebooks.service';
import { db } from '../db';

const mocks = vi.hoisted(() => ({ streamText: vi.fn() }));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: mocks.streamText };
});

type StreamOptions = {
  onChunk: (event: { chunk: { type: string; text?: string } }) => void;
  onEnd: (event: {
    text: string;
    reasoning?: string;
    usage?: Record<string, unknown>;
    finishReason: string;
  }) => Promise<void>;
  onAbort: () => Promise<void>;
  model: unknown;
  instructions: string;
  messages: Array<{ role: string; content: unknown }>;
};

const MODEL = 'openai/gpt-5.6-sol';
const NOTEBOOK_ID = 'chat-branch-lifecycle-notebook';

describe('ChatService chat branch lifecycle (PostgreSQL)', () => {
  let service: ChatService;
  let module: TestingModule;
  let streamCalls: StreamOptions[];
  let retrievalCalls: Array<Record<string, unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    streamCalls = [];
    retrievalCalls = [];
    mocks.streamText.mockImplementation((options: StreamOptions) => {
      streamCalls.push(options);
      return {
        toUIMessageStreamResponse: vi.fn(() => new Response()),
      };
    });

    await db.insert(schema.notebooks).values({
      id: NOTEBOOK_ID,
      title: 'Chat branch lifecycle',
      groundingMode: 'free',
    });

    module = await Test.createTestingModule({
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
            getProviderForModel: vi.fn().mockResolvedValue({
              createModel: vi.fn((id: string) => ({
                provider: 'test',
                modelId: id,
              })),
              listModels: vi.fn(() => []),
            }),
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
          useValue: {
            retrieve: vi.fn(async (input: Record<string, unknown>) => {
              retrievalCalls.push(input);
              return {
                chunks: [],
                abstained: false,
                abstentionReason: null,
                unhelpfulSources: [],
                trace: { chosen: [] },
              };
            }),
          },
        },
        {
          provide: RetrievalTraceService,
          useValue: {
            record: vi.fn().mockResolvedValue(undefined),
            clearChatTraces: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get(ChatService);
  });

  afterAll(async () => {
    await module?.close();
  });

  async function complete(text: string) {
    const options = streamCalls.at(-1);
    if (!options) throw new Error('Expected a captured AI stream call');
    await options.onEnd({ text, reasoning: '', finishReason: 'stop' });
  }

  async function send(input: Omit<SendInput, 'model'>, model = MODEL) {
    return service.sendMessage(NOTEBOOK_ID, { ...input, model });
  }

  async function selectedPath() {
    const history = await service.listMessages(NOTEBOOK_ID);
    return {
      ids: history.selectedPathIds,
      selectedId: history.selectedMessageId,
      messages: history.messages,
    };
  }

  it('keeps nested edits, selection, regeneration, and stopped retries on their selected ancestry', async () => {
    const root = await send({
      messageId: 'user-root-v1',
      content: 'Root question version one',
      parts: [{ type: 'text', text: 'Root question version one' }],
      sourceIds: [],
    });
    expect(root.userMessageId).toBe('user-root-v1');
    await complete('Root answer one');
    const rootAnswer = (await selectedPath()).selectedId!;

    const child = await send({
      messageId: 'user-child-v1',
      parentMessageId: rootAnswer,
      content: 'Nested question version one',
      parts: [{ type: 'text', text: 'Nested question version one' }],
      sourceIds: [],
    });
    await complete('Nested answer one');
    const childAnswer = (await selectedPath()).selectedId!;

    const rootEdit = await send({
      messageId: 'user-root-v2',
      editMessageId: 'user-root-v1',
      content: 'Root question version two',
      sourceIds: [],
    });
    expect(rootEdit.userMessageId).toBe('user-root-v2');
    await complete('Root answer two');
    const editedRootAnswer = (await selectedPath()).selectedId!;

    expect(await service.selectMessage(NOTEBOOK_ID, 'user-root-v1')).toBe(
      childAnswer,
    );
    expect(await service.selectMessage(NOTEBOOK_ID, 'user-root-v1')).toBe(
      childAnswer,
    );
    expect((await selectedPath()).ids).toEqual([
      'user-root-v1',
      rootAnswer,
      'user-child-v1',
      childAnswer,
    ]);
    expect(
      (await selectedPath()).messages.find(
        (message) => message.id === child.userMessageId,
      )?.parentId,
    ).toBe(rootAnswer);
    expect(await service.selectMessage(NOTEBOOK_ID, 'user-root-v2')).toBe(
      editedRootAnswer,
    );

    const nestedOnEditedRoot = await send({
      messageId: 'user-child-v2-base',
      parentMessageId: editedRootAnswer,
      content: 'Nested question on root version two',
      parts: [{ type: 'text', text: 'Nested question on root version two' }],
      sourceIds: [],
    });
    await complete('Nested answer on root version two');

    const nestedEdit = await send({
      messageId: 'user-child-v2',
      editMessageId: nestedOnEditedRoot.userMessageId,
      content: 'Nested question version two',
      sourceIds: [],
    });
    expect(nestedEdit.userMessageId).toBe('user-child-v2');
    await complete('Nested answer two');
    const nestedEditedAnswer = (await selectedPath()).selectedId!;
    expect((await selectedPath()).ids).toEqual([
      'user-root-v2',
      editedRootAnswer,
      'user-child-v2',
      nestedEditedAnswer,
    ]);

    const beforeRegenCalls = streamCalls.length;
    await send(
      {
        regenerateMessageId: nestedEditedAnswer,
        content: 'Nested question version two',
        sourceIds: [],
        groundingMode: 'moderate',
      },
      'google/gemini-2.5-pro',
    );
    const regenCall = streamCalls[beforeRegenCalls];
    expect(regenCall.model).toEqual({
      provider: 'test',
      modelId: 'google/gemini-2.5-pro',
    });
    expect(regenCall.instructions).toContain('General knowledge:');
    expect(regenCall.messages).toEqual([
      { role: 'user', content: 'Root question version two' },
      { role: 'assistant', content: 'Root answer two' },
      { role: 'user', content: 'Nested question version two' },
    ]);
    expect(retrievalCalls.at(-1)?.history).toEqual([
      { role: 'user', content: 'Root question version two' },
      { role: 'assistant', content: 'Root answer two' },
    ]);
    await complete('Nested regenerated answer');
    const regeneratedAnswer = (await selectedPath()).selectedId!;
    expect((await selectedPath()).ids).toEqual([
      'user-root-v2',
      editedRootAnswer,
      'user-child-v2',
      regeneratedAnswer,
    ]);
    expect(child.userMessageId).toBe('user-child-v1');
    expect(childAnswer).not.toBe(nestedEditedAnswer);

    const stoppedId = 'user-after-stop';
    await send(
      {
        messageId: stoppedId,
        parentMessageId: regeneratedAnswer,
        content: 'Question after stop',
        parts: [{ type: 'text', text: 'Question after stop' }],
        sourceIds: [],
      },
      'anthropic/claude-sonnet-4.5',
    );
    const stoppedStream = streamCalls.at(-1)!;
    stoppedStream.onChunk({ chunk: { type: 'text-delta', text: 'Partial' } });
    await stoppedStream.onAbort();
    expect((await selectedPath()).selectedId).toBe(stoppedId);
    expect(
      (await selectedPath()).messages.find(
        (message) => message.id === stoppedId,
      )?.parentId,
    ).toBe(regeneratedAnswer);

    await send(
      {
        messageId: stoppedId,
        parentMessageId: regeneratedAnswer,
        content: 'Question after stop',
        parts: [{ type: 'text', text: 'Question after stop' }],
        sourceIds: [],
      },
      'anthropic/claude-sonnet-4.5',
    );
    expect(
      await db
        .select()
        .from(schema.notebookChatMessages)
        .where(eq(schema.notebookChatMessages.id, stoppedId)),
    ).toHaveLength(1);
    expect(streamCalls.at(-1)?.messages).toEqual([
      { role: 'user', content: 'Root question version two' },
      { role: 'assistant', content: 'Root answer two' },
      { role: 'user', content: 'Nested question version two' },
      { role: 'assistant', content: 'Nested regenerated answer' },
      { role: 'user', content: 'Question after stop' },
    ]);
    expect(streamCalls.at(-1)?.model).toEqual({
      provider: 'test',
      modelId: 'anthropic/claude-sonnet-4.5',
    });
    await complete('Retry answer');
    const completedPath = await selectedPath();
    expect(completedPath.ids.at(-1)).not.toBe(stoppedId);
    expect(
      completedPath.messages.find((message) => message.id === stoppedId)
        ?.isOnSelectedPath,
    ).toBe(true);
    expect(
      completedPath.messages.find((message) => message.id === stoppedId)
        ?.isSelected,
    ).toBe(false);
    expect(streamCalls.map((call) => call.messages.at(-1)?.content)).toContain(
      'Question after stop',
    );
  });

  it('restores all three levels and each remembered version after editing an ancestor and reopening the service', async () => {
    await send({ messageId: 'remember-root', content: 'Original root' });
    await complete('Original root answer');
    const rootAnswer = (await selectedPath()).selectedId!;
    await send({
      messageId: 'remember-middle',
      parentMessageId: rootAnswer,
      content: 'Original middle',
    });
    await complete('Original middle answer');
    const middleAnswer = (await selectedPath()).selectedId!;
    await send({
      messageId: 'remember-leaf',
      parentMessageId: middleAnswer,
      content: 'Original leaf',
    });
    await complete('Original leaf answer');
    const leafAnswer = (await selectedPath()).selectedId!;

    await send({
      messageId: 'remember-leaf-edit',
      editMessageId: 'remember-leaf',
      content: 'Edited leaf',
    });
    await complete('Edited leaf answer');
    const editedLeafAnswer = (await selectedPath()).selectedId!;
    await service.selectMessage(NOTEBOOK_ID, leafAnswer);

    await send({
      messageId: 'remember-root-edit',
      editMessageId: 'remember-root',
      content: 'Edited root',
    });
    await complete('Edited root answer');
    const editedRootAnswer = (await selectedPath()).selectedId!;
    const originalPath = [
      'remember-root',
      rootAnswer,
      'remember-middle',
      middleAnswer,
      'remember-leaf',
      leafAnswer,
    ];

    expect(await service.selectMessage(NOTEBOOK_ID, 'remember-root')).toBe(
      leafAnswer,
    );
    expect((await selectedPath()).ids).toEqual(originalPath);
    for (let round = 0; round < 3; round++) {
      expect(
        await service.selectMessage(NOTEBOOK_ID, 'remember-root-edit'),
      ).toBe(editedRootAnswer);
      expect((await selectedPath()).ids).toEqual([
        'remember-root-edit',
        editedRootAnswer,
      ]);
      expect(await service.selectMessage(NOTEBOOK_ID, 'remember-root')).toBe(
        leafAnswer,
      );
      expect((await selectedPath()).ids).toEqual(originalPath);
    }

    expect(await service.selectMessage(NOTEBOOK_ID, 'remember-leaf-edit')).toBe(
      editedLeafAnswer,
    );
    await send({
      regenerateMessageId: editedLeafAnswer,
      content: 'Edited leaf',
    });
    await complete('Regenerated edited leaf answer');
    const regeneratedLeafAnswer = (await selectedPath()).selectedId!;
    await service.selectMessage(NOTEBOOK_ID, editedLeafAnswer);
    await service.selectMessage(NOTEBOOK_ID, 'remember-root-edit');

    service = new ChatService(
      db,
      module.get(NotebooksService),
      module.get(AiService),
      module.get(ConnectionService),
      module.get(RetrievalService),
      module.get(RetrievalTraceService),
    );
    expect(await service.selectMessage(NOTEBOOK_ID, 'remember-root')).toBe(
      editedLeafAnswer,
    );
    expect((await selectedPath()).ids).toEqual([
      'remember-root',
      rootAnswer,
      'remember-middle',
      middleAnswer,
      'remember-leaf-edit',
      editedLeafAnswer,
    ]);
    expect(
      (await selectedPath()).messages.some(
        (message) => message.id === regeneratedLeafAnswer,
      ),
    ).toBe(true);
    expect((await selectedPath()).ids).not.toContain(regeneratedLeafAnswer);

    await send({
      messageId: 'remember-followup',
      parentMessageId: editedLeafAnswer,
      content: 'Continue remembered branch',
    });
    expect(streamCalls.at(-1)?.messages).toEqual([
      { role: 'user', content: 'Original root' },
      { role: 'assistant', content: 'Original root answer' },
      { role: 'user', content: 'Original middle' },
      { role: 'assistant', content: 'Original middle answer' },
      { role: 'user', content: 'Edited leaf' },
      { role: 'assistant', content: 'Edited leaf answer' },
      { role: 'user', content: 'Continue remembered branch' },
    ]);
  });

  it('preserves independent branch choices through a seeded mix of edits, regeneration, and navigation', async () => {
    const nodes = new Map<
      string,
      { role: 'user' | 'assistant'; parentId: string | null; content: string }
    >();
    // The reference stores complete bookmarks, independently of how production
    // persists branch choices. Every visited ancestor remembers that endpoint.
    const bookmarks = new Map<string, string>();
    let selected: string | null = null;
    let seed = 17473;
    const next = (length: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % length;
    };
    const ancestry = (id: string | null): string[] => {
      const path: string[] = [];
      for (let node = id; node; node = nodes.get(node)!.parentId)
        path.unshift(node);
      return path;
    };
    const remember = (endpoint: string) => {
      for (const ancestor of ancestry(endpoint))
        bookmarks.set(ancestor, endpoint);
      selected = endpoint;
    };
    const assertPath = async () => {
      const actual = await selectedPath();
      expect(actual.ids).toEqual(ancestry(selected));
      expect(actual.messages).toHaveLength(nodes.size);
    };

    for (let step = 0; step < 64; step++) {
      const users = [...nodes]
        .filter(([, node]) => node.role === 'user')
        .map(([id]) => id);
      const assistants = [...nodes]
        .filter(([, node]) => node.role === 'assistant')
        .map(([id]) => id);
      const operation = step === 0 ? 0 : next(4);
      if (operation === 3) {
        const choices = [...nodes.keys()];
        const target = choices[next(choices.length)];
        const expected = bookmarks.get(target) ?? target;
        expect(await service.selectMessage(NOTEBOOK_ID, target)).toBe(expected);
        remember(expected);
        await assertPath();
        continue;
      }

      let userId: string;
      let parentId: string | null;
      let content: string;
      let input: Omit<SendInput, 'model'>;
      if (operation === 2 && assistants.length) {
        const target = assistants[next(assistants.length)];
        userId = nodes.get(target)!.parentId!;
        parentId = nodes.get(userId)!.parentId;
        content = nodes.get(userId)!.content;
        input = { regenerateMessageId: target, content };
      } else {
        userId = `seeded-user-${step}`;
        content = `User content ${step}`;
        const editTarget =
          operation === 1 && users.length
            ? users[next(users.length)]
            : undefined;
        parentId = editTarget ? nodes.get(editTarget)!.parentId : selected;
        input = editTarget
          ? { messageId: userId, editMessageId: editTarget, content }
          : { messageId: userId, parentMessageId: parentId, content };
        nodes.set(userId, { role: 'user', parentId, content });
      }
      await send(input);
      expect(streamCalls.at(-1)?.messages).toEqual([
        ...ancestry(parentId)
          .slice(-6)
          .map((id) => ({
            role: nodes.get(id)!.role,
            content: nodes.get(id)!.content,
          })),
        { role: 'user', content },
      ]);
      const answer = `Assistant content ${step}`;
      await complete(answer);
      const endpoint = (await selectedPath()).selectedId!;
      expect(nodes.has(endpoint)).toBe(false);
      nodes.set(endpoint, {
        role: 'assistant',
        parentId: userId,
        content: answer,
      });
      remember(endpoint);
      await assertPath();
    }
  });

  it('rejects a stale send claim after a real concurrent selection change and removes its inserted node', async () => {
    await db.insert(schema.notebookChatMessages).values([
      {
        id: 'race-user-a',
        notebookId: NOTEBOOK_ID,
        role: 'user',
        content: 'Branch A',
        parts: [{ type: 'text', text: 'Branch A' }],
        groundingMode: 'free',
      },
      {
        id: 'race-assistant-a',
        notebookId: NOTEBOOK_ID,
        parentId: 'race-user-a',
        role: 'assistant',
        content: 'Answer A',
        parts: [{ type: 'text', text: 'Answer A' }],
        groundingMode: 'free',
      },
      {
        id: 'race-user-b',
        notebookId: NOTEBOOK_ID,
        role: 'user',
        content: 'Branch B',
        parts: [{ type: 'text', text: 'Branch B' }],
        groundingMode: 'free',
      },
      {
        id: 'race-assistant-b',
        notebookId: NOTEBOOK_ID,
        parentId: 'race-user-b',
        role: 'assistant',
        content: 'Answer B',
        parts: [{ type: 'text', text: 'Answer B' }],
        groundingMode: 'free',
      },
    ]);
    await db
      .update(schema.notebooks)
      .set({ selectedChatMessageId: 'race-assistant-a' })
      .where(eq(schema.notebooks.id, NOTEBOOK_ID));

    let interleaved = false;
    const interceptedDb = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== 'insert')
          return Reflect.get(target, property, receiver);
        return (table: typeof schema.notebookChatMessages) => {
          const query = target.insert(table);
          const values = query.values.bind(query);
          query.values = ((...args: Parameters<typeof query.values>) => {
            const insertQuery = values(...args);
            if (table !== schema.notebookChatMessages || interleaved)
              return insertQuery;
            const returning = insertQuery.returning.bind(insertQuery);
            insertQuery.returning = ((
              ...returnArgs: Parameters<typeof insertQuery.returning>
            ) => {
              const returningQuery = returning(...returnArgs);
              const then = returningQuery.then.bind(returningQuery);
              return Object.assign(returningQuery, {
                then: (
                  resolve: (rows: unknown[]) => unknown,
                  reject: (error: unknown) => unknown,
                ) =>
                  then(async (rows) => {
                    if (!interleaved) {
                      interleaved = true;
                      await service.selectMessage(
                        NOTEBOOK_ID,
                        'race-assistant-b',
                      );
                    }
                    return resolve(rows);
                  }, reject),
              });
            }) as typeof insertQuery.returning;
            return insertQuery;
          }) as typeof query.values;
          return query;
        };
      },
    }) as NodePgDatabase<typeof schema>;

    const racedService = new ChatService(
      interceptedDb,
      module.get(NotebooksService),
      module.get(AiService),
      module.get(ConnectionService),
      module.get(RetrievalService),
      module.get(RetrievalTraceService),
    );

    await expect(
      racedService.sendMessage(NOTEBOOK_ID, {
        messageId: 'race-lost-user',
        parentMessageId: 'race-assistant-a',
        content: 'Concurrent branch request',
        sourceIds: [],
        model: MODEL,
      }),
    ).rejects.toThrow('Chat branch changed while starting the message');

    const notebook = await db
      .select({ selectedChatMessageId: schema.notebooks.selectedChatMessageId })
      .from(schema.notebooks)
      .where(eq(schema.notebooks.id, NOTEBOOK_ID));
    expect(notebook[0]?.selectedChatMessageId).toBe('race-assistant-b');
    expect(
      await db
        .select()
        .from(schema.notebookChatMessages)
        .where(eq(schema.notebookChatMessages.id, 'race-lost-user')),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.notebookChatMessages)
        .where(
          and(
            eq(schema.notebookChatMessages.notebookId, NOTEBOOK_ID),
            eq(schema.notebookChatMessages.role, 'user'),
          ),
        ),
    ).toHaveLength(2);
    expect(mocks.streamText).not.toHaveBeenCalled();
  });
});
