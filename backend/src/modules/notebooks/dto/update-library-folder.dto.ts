import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateLibraryFolderSchema = z.object({
  name: z.string().min(1).max(200).optional().describe('New folder name.'),
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe('New parent library folder, or null for the library root.'),
});

export class UpdateLibraryFolderDto extends createZodDto(
  updateLibraryFolderSchema,
) {}
