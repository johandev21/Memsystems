import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createUploadTargetSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe('Original filename of the file to upload.'),
  contentType: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('MIME type of the file to upload.'),
  size: z.number().int().positive().describe('File size in bytes.'),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional()
    .describe('Optional SHA-256 checksum of the file, as 64 hex characters.'),
});

export class CreateUploadTargetDto extends createZodDto(
  createUploadTargetSchema,
) {}
