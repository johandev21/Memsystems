import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateSourceFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name cannot be empty')
    .max(200)
    .optional()
    .describe('New source folder name.'),
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe('New parent source folder, or null for the notebook root.'),
});

export class UpdateSourceFolderDto extends createZodDto(
  updateSourceFolderSchema,
) {}
