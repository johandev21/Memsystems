import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  agentAccessLevelSchema,
  agentConfirmPolicySchema,
  agentSoftDeletePolicySchema,
} from './agent-access.schemas';

export const updateAgentAccessSchema = z.object({
  softDelete: agentSoftDeletePolicySchema.optional(),
  permanentDelete: agentConfirmPolicySchema.optional(),
  resourceDelete: agentConfirmPolicySchema.optional(),
  notebookDefault: agentAccessLevelSchema.optional(),
});

export class UpdateAgentAccessDto extends createZodDto(
  updateAgentAccessSchema,
) {}

export const createAgentKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100)
    .describe('Human-readable name shown in Settings.'),
});

export class CreateAgentKeyDto extends createZodDto(createAgentKeySchema) {}
