import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createSourceFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name cannot be empty')
    .max(200)
    .describe('Name of the source folder.'),
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe('Parent source folder, or null for the notebook root.'),
});

export class CreateSourceFolderDto extends createZodDto(
  createSourceFolderSchema,
) {}
