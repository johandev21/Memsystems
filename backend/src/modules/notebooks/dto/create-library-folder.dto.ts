import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createLibraryFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(200, 'Folder name must be at most 200 characters')
    .describe('Name of the library folder.'),
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe('Parent library folder, or null for the library root.'),
});

export class CreateLibraryFolderDto extends createZodDto(
  createLibraryFolderSchema,
) {}
