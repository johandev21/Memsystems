import type { SchemaObject } from '@nestjs/swagger';

/**
 * Reusable component schemas for the two streaming endpoints:
 *
 * - `POST /api/notebooks/{id}/generate` writes newline-delimited JSON
 *   (`application/x-ndjson`).
 * - `POST /api/notebooks/{id}/chat` returns the AI SDK UI message stream
 *   (`text/event-stream`, one `data: <json>` line per frame).
 *
 * These are hand-written rather than generated from Zod DTOs because the
 * frames are emitted as partial model output and are not request bodies.
 */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const generationPartialFrame: SchemaObject = {
  type: 'object',
  description:
    'A partial Study Material content object. Fields appear as the model produces them, so any subset of the kind-specific content shape may be present and strings may be incomplete. The frame is a partial of the quiz, flashcard, roadmap, mind map, or slides content shape selected by `kind`.',
  additionalProperties: true,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    questions: { type: 'array', items: { type: 'object' } },
    cards: { type: 'array', items: { type: 'object' } },
    phases: { type: 'array', items: { type: 'object' } },
    rootId: { type: 'string' },
    nodes: { type: 'array', items: { type: 'object' } },
    edges: { type: 'array', items: { type: 'object' } },
    design: { type: 'object' },
    slides: { type: 'array', items: { type: 'object' } },
    generalKnowledgeSupplement: {
      type: 'string',
      description:
        'Present only for moderate grounding; context that goes beyond the sources.',
    },
  },
};

const generationDoneFrame: SchemaObject = {
  type: 'object',
  description:
    'Terminal frame. The Study Material has been persisted and the Generation is complete.',
  required: ['done', 'requestId', 'materialId'],
  properties: {
    done: { type: 'boolean', enum: [true] },
    requestId: {
      type: 'string',
      description:
        'Generation Request id, also sent as X-Generation-Request-Id.',
    },
    materialId: {
      type: 'string',
      description: 'Id of the created Study Material.',
    },
    grounding: {
      type: 'object',
      description: 'Grounding diagnostics for the Generation.',
      properties: {
        droppedBlocks: { type: 'integer', minimum: 0 },
        truncatedSourceIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
};

const generationErrorFrame: SchemaObject = {
  type: 'object',
  description:
    'Terminal frame written after the stream has started. The client should surface `error` and stop reading.',
  required: ['error'],
  properties: {
    error: {
      type: 'string',
      description: 'Client-safe error message.',
    },
    requestId: {
      type: 'string',
      description: 'Generation Request id, when one was created.',
    },
  },
};

const generationFailureResponse: SchemaObject = {
  type: 'object',
  description:
    'JSON error returned before any NDJSON frame was written (for example when the selected Sources are unavailable).',
  required: ['error', 'code'],
  properties: {
    error: { type: 'string' },
    code: { type: 'string', enum: ['generation_failed'] },
    requestId: { type: 'string' },
  },
};

const chatCitationCheck: SchemaObject = {
  type: 'object',
  description: 'Summary of Citation verification for the completed reply.',
  properties: {
    resolved: {
      type: 'integer',
      minimum: 0,
      description: 'Number of Citation keys that matched Evidence.',
    },
    attributed: {
      type: 'integer',
      minimum: 0,
      description: 'Number of claims linked by Nearest-Evidence Attribution.',
    },
    dropped: {
      type: 'integer',
      minimum: 0,
      description: 'Number of unresolvable Citation keys that were dropped.',
    },
  },
};

const chatCitedSource: SchemaObject = {
  type: 'object',
  description: 'One Source passage cited by the assistant reply.',
  required: ['sourceId', 'citationKey', 'number'],
  properties: {
    schemaVersion: { type: 'integer' },
    citationKey: {
      type: 'string',
      description: 'Citation key used in the reply text, such as R1.',
    },
    sourceId: { type: 'string' },
    chunkId: { type: 'string', nullable: true },
    chunkIndex: { type: 'integer', nullable: true },
    sourceVersionId: { type: 'string', nullable: true },
    locator: {
      type: 'object',
      nullable: true,
      description: 'Kind-specific locator inside the Source.',
      additionalProperties: true,
    },
    number: {
      type: 'integer',
      minimum: 1,
      description: 'Display number of the Citation.',
    },
    title: { type: 'string', nullable: true },
    kind: { type: 'string', nullable: true },
    url: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    quote: {
      type: 'string',
      nullable: true,
      description: 'Supporting Span quoted from the Source Chunk.',
    },
    attribution: {
      type: 'string',
      enum: ['explicit', 'nearest'],
      description:
        'Whether the Citation was written by the model or linked by Nearest-Evidence Attribution.',
    },
    sectionPath: {
      type: 'array',
      nullable: true,
      items: { type: 'string' },
    },
    context: { type: 'string', nullable: true },
  },
};

const chatMessageMetadata: SchemaObject = {
  type: 'object',
  description:
    'Metadata attached to the `start`/`finish` frames and persisted with the assistant message. Citation fields are populated on `finish`.',
  properties: {
    modelId: { type: 'string' },
    groundingMode: {
      type: 'string',
      enum: ['strict', 'moderate', 'free'],
    },
    finishReason: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
    totalUsage: {
      type: 'object',
      properties: {
        inputTokens: { type: 'integer', minimum: 0 },
        outputTokens: { type: 'integer', minimum: 0 },
        totalTokens: { type: 'integer', minimum: 0 },
      },
    },
    citedSources: {
      type: 'array',
      items: ref('ChatCitedSource'),
    },
    citationCheck: ref('ChatCitationCheck'),
  },
};

const chatUiStreamStartFrame: SchemaObject = {
  type: 'object',
  description: 'First frame of a reply.',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ['start'] },
    messageId: {
      type: 'string',
      description: 'Persisted assistant message id.',
    },
    messageMetadata: ref('ChatMessageMetadata'),
  },
};

const chatUiStreamStartStepFrame: SchemaObject = {
  type: 'object',
  description: 'Marks the start of one model step.',
  required: ['type'],
  properties: { type: { type: 'string', enum: ['start-step'] } },
};

const chatUiStreamReasoningStartFrame: SchemaObject = {
  type: 'object',
  description: 'Starts a reasoning part.',
  required: ['type', 'id'],
  properties: {
    type: { type: 'string', enum: ['reasoning-start'] },
    id: { type: 'string' },
  },
};

const chatUiStreamReasoningDeltaFrame: SchemaObject = {
  type: 'object',
  description: 'Incremental reasoning text.',
  required: ['type', 'id', 'delta'],
  properties: {
    type: { type: 'string', enum: ['reasoning-delta'] },
    id: { type: 'string' },
    delta: { type: 'string' },
  },
};

const chatUiStreamReasoningEndFrame: SchemaObject = {
  type: 'object',
  description: 'Ends a reasoning part.',
  required: ['type', 'id'],
  properties: {
    type: { type: 'string', enum: ['reasoning-end'] },
    id: { type: 'string' },
  },
};

const chatUiStreamTextStartFrame: SchemaObject = {
  type: 'object',
  description: 'Starts the assistant text part.',
  required: ['type', 'id'],
  properties: {
    type: { type: 'string', enum: ['text-start'] },
    id: { type: 'string' },
  },
};

const chatUiStreamTextDeltaFrame: SchemaObject = {
  type: 'object',
  description:
    'Incremental assistant text. Citations appear inline as `[ref:R1]` markers.',
  required: ['type', 'id', 'delta'],
  properties: {
    type: { type: 'string', enum: ['text-delta'] },
    id: { type: 'string' },
    delta: { type: 'string' },
  },
};

const chatUiStreamTextEndFrame: SchemaObject = {
  type: 'object',
  description: 'Ends the assistant text part.',
  required: ['type', 'id'],
  properties: {
    type: { type: 'string', enum: ['text-end'] },
    id: { type: 'string' },
  },
};

const chatUiStreamFinishStepFrame: SchemaObject = {
  type: 'object',
  description: 'Marks the end of one model step.',
  required: ['type'],
  properties: { type: { type: 'string', enum: ['finish-step'] } },
};

const chatUiStreamFinishFrame: SchemaObject = {
  type: 'object',
  description:
    'Terminal frame. `messageMetadata.citedSources` lists the Citations for this reply.',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ['finish'] },
    finishReason: { type: 'string' },
    messageMetadata: ref('ChatMessageMetadata'),
  },
};

const chatUiStreamAbortFrame: SchemaObject = {
  type: 'object',
  description:
    'The reply was aborted, for example because the client disconnected.',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ['abort'] },
    reason: { type: 'string' },
  },
};

const chatUiStreamErrorFrame: SchemaObject = {
  type: 'object',
  description: 'A client-safe error. The stream may continue after this frame.',
  required: ['type', 'errorText'],
  properties: {
    type: { type: 'string', enum: ['error'] },
    errorText: { type: 'string' },
  },
};

const chatUiStreamMessageMetadataFrame: SchemaObject = {
  type: 'object',
  description:
    'Replaces or attaches metadata to the current assistant message.',
  required: ['type', 'messageMetadata'],
  properties: {
    type: { type: 'string', enum: ['message-metadata'] },
    messageMetadata: ref('ChatMessageMetadata'),
  },
};

const chatUiStreamSourceUrlFrame: SchemaObject = {
  type: 'object',
  description: 'A URL Source referenced by the reply.',
  required: ['type', 'sourceId', 'url'],
  properties: {
    type: { type: 'string', enum: ['source-url'] },
    sourceId: { type: 'string' },
    url: { type: 'string' },
    title: { type: 'string' },
  },
};

const chatUiStreamSourceDocumentFrame: SchemaObject = {
  type: 'object',
  description: 'A document Source referenced by the reply.',
  required: ['type', 'sourceId', 'mediaType', 'title'],
  properties: {
    type: { type: 'string', enum: ['source-document'] },
    sourceId: { type: 'string' },
    mediaType: { type: 'string' },
    title: { type: 'string' },
    filename: { type: 'string' },
  },
};

const chatUiStreamFrame: SchemaObject = {
  type: 'object',
  description:
    'One server-sent event. Each `data:` line contains one of the listed frames; the stream ends with `data: [DONE]`. Consumers normally pass the stream to the AI SDK client, which assembles the frames into an assistant message.',
  oneOf: [
    ref('ChatUiStreamStartFrame'),
    ref('ChatUiStreamStartStepFrame'),
    ref('ChatUiStreamReasoningStartFrame'),
    ref('ChatUiStreamReasoningDeltaFrame'),
    ref('ChatUiStreamReasoningEndFrame'),
    ref('ChatUiStreamTextStartFrame'),
    ref('ChatUiStreamTextDeltaFrame'),
    ref('ChatUiStreamTextEndFrame'),
    ref('ChatUiStreamFinishStepFrame'),
    ref('ChatUiStreamFinishFrame'),
    ref('ChatUiStreamAbortFrame'),
    ref('ChatUiStreamErrorFrame'),
    ref('ChatUiStreamMessageMetadataFrame'),
    ref('ChatUiStreamSourceUrlFrame'),
    ref('ChatUiStreamSourceDocumentFrame'),
  ],
};

export const openApiStreamSchemas: Record<string, SchemaObject> = {
  GenerationPartialFrame: generationPartialFrame,
  GenerationDoneFrame: generationDoneFrame,
  GenerationErrorFrame: generationErrorFrame,
  GenerationFailureResponse: generationFailureResponse,
  GenerationStreamFrame: {
    type: 'object',
    description:
      'One NDJSON line from `POST /api/notebooks/{id}/generate`. Lines are emitted as partial Study Material content, followed by exactly one terminal `done` or `error` frame.',
    oneOf: [
      ref('GenerationPartialFrame'),
      ref('GenerationDoneFrame'),
      ref('GenerationErrorFrame'),
    ],
  },
  ChatCitationCheck: chatCitationCheck,
  ChatCitedSource: chatCitedSource,
  ChatMessageMetadata: chatMessageMetadata,
  ChatUiStreamStartFrame: chatUiStreamStartFrame,
  ChatUiStreamStartStepFrame: chatUiStreamStartStepFrame,
  ChatUiStreamReasoningStartFrame: chatUiStreamReasoningStartFrame,
  ChatUiStreamReasoningDeltaFrame: chatUiStreamReasoningDeltaFrame,
  ChatUiStreamReasoningEndFrame: chatUiStreamReasoningEndFrame,
  ChatUiStreamTextStartFrame: chatUiStreamTextStartFrame,
  ChatUiStreamTextDeltaFrame: chatUiStreamTextDeltaFrame,
  ChatUiStreamTextEndFrame: chatUiStreamTextEndFrame,
  ChatUiStreamFinishStepFrame: chatUiStreamFinishStepFrame,
  ChatUiStreamFinishFrame: chatUiStreamFinishFrame,
  ChatUiStreamAbortFrame: chatUiStreamAbortFrame,
  ChatUiStreamErrorFrame: chatUiStreamErrorFrame,
  ChatUiStreamMessageMetadataFrame: chatUiStreamMessageMetadataFrame,
  ChatUiStreamSourceUrlFrame: chatUiStreamSourceUrlFrame,
  ChatUiStreamSourceDocumentFrame: chatUiStreamSourceDocumentFrame,
  ChatUiStreamFrame: chatUiStreamFrame,
};
