import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { groundingModeSchema } from '../../../common/dto/shared-schemas';
import { agentAccessLevelSchema } from '../../agent-access/dto/agent-access.schemas';

export const updateNotebookSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200)
    .optional()
    .describe('New notebook title.'),
  description: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .describe('New description, or null to clear it.'),
  icon: z
    .string()
    .max(50)
    .nullable()
    .optional()
    .describe('New icon identifier, or null to clear it.'),
  folderId: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Library folder to move the notebook into, or null for the root.',
    ),
  groundingMode: groundingModeSchema.optional(),
  agentAccess: agentAccessLevelSchema
    .nullable()
    .optional()
    .describe(
      'Agent access override for this Notebook, or null to inherit the workspace default.',
    ),
  bannerFocalPoint: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .nullable()
    .optional()
    .describe('Focal point of the notebook banner, or null to reset it.'),
});

export class UpdateNotebookDto extends createZodDto(updateNotebookSchema) {}
