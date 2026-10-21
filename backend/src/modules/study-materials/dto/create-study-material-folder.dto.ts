import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createStudyMaterialFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(200)
    .describe('Name of the study material folder.'),
  parentId: z.string().optional().describe('Parent study material folder.'),
});

export class CreateStudyMaterialFolderDto extends createZodDto(
  createStudyMaterialFolderSchema,
) {}
