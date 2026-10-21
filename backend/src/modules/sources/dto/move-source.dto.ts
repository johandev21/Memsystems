import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const moveSourceSchema = z.object({
  folderId: z
    .string()
    .nullable()
    .describe('Source folder to move the source into, or null for the root.'),
});

export class MoveSourceDto extends createZodDto(moveSourceSchema) {}
