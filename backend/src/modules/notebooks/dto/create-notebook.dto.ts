import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { groundingModeSchema } from '../../../common/dto/shared-schemas';

export const createNotebookSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .describe('Title of the notebook.'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .describe('Optional short description of the notebook.'),
  icon: z
    .string()
    .max(50, 'Icon must be at most 50 characters')
    .optional()
    .describe('Optional icon identifier.'),
  folderId: z
    .string()
    .nullable()
    .optional()
    .describe('Library folder that should contain the notebook.'),
  groundingMode: groundingModeSchema.optional(),
});

export class CreateNotebookDto extends createZodDto(createNotebookSchema) {}
