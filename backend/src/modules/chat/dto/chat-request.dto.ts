import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { groundingModeSchema } from '../../../common/dto/shared-schemas';

export const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
});

export const reasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
});

export const filePartSchema = z.object({
  type: z.literal('file'),
  mediaType: z.string(),
  url: z.string(),
  filename: z.string().optional(),
});

export const messagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  filePartSchema,
]);

export const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(messagePartSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1)
    .describe('Chat messages for the turn, oldest first.'),
  model: z.string().min(1).describe('Model identifier selected for the Chat.'),
  message: messageSchema
    .optional()
    .describe('Optional message being sent in this request.'),
  regenerateMessageId: z
    .string()
    .optional()
    .describe('Assistant message to regenerate, when retrying a reply.'),
  language: z
    .string()
    .min(1)
    .max(35)
    .optional()
    .describe('Base Language code used for the reply.'),
  groundingMode: groundingModeSchema.optional(),
});

export class ChatRequestDto extends createZodDto(chatRequestSchema) {}
