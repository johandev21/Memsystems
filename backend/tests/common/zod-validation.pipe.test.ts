import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string(),
  });
  const pipe = new ZodValidationPipe(schema);

  it('should pass non-body arguments through without validating against schema', () => {
    const userId = 'usr_12345';
    const result = pipe.transform(userId, { type: 'custom', data: 'id' });
    expect(result).toBe('usr_12345');

    const paramId = 'folder_99';
    const paramResult = pipe.transform(paramId, { type: 'param', data: 'id' });
    expect(paramResult).toBe('folder_99');
  });

  it('should validate body arguments and return parsed data', () => {
    const validBody = { name: 'Test Folder' };
    const result = pipe.transform(validBody, { type: 'body' });
    expect(result).toEqual({ name: 'Test Folder' });
  });

  it('should throw BadRequestError on invalid body arguments', () => {
    const invalidBody = { name: 123 };
    expect(() => pipe.transform(invalidBody, { type: 'body' })).toThrow(
      'name: Invalid input: expected string, received number',
    );
  });
});
