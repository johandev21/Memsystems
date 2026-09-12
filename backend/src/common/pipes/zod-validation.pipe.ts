import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { BadRequestError, DomainErrorParams } from '../errors/domain-error';

function toParam(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return undefined;
}

function mapIssue(issue: { code: string; path: PropertyKey[] }): {
  messageKey: string;
  params: DomainErrorParams;
} {
  const field = issue.path.length > 0 ? issue.path.join('.') : 'body';
  switch (issue.code) {
    case 'invalid_type': {
      const params: DomainErrorParams = { field };
      const expected = toParam((issue as { expected?: unknown }).expected);
      if (expected !== undefined) params.expected = expected;
      return { messageKey: 'errors.validation.invalidType', params };
    }
    case 'too_small': {
      const params: DomainErrorParams = { field };
      const minimum = toParam((issue as { minimum?: unknown }).minimum);
      if (minimum !== undefined) params.minimum = minimum;
      return { messageKey: 'errors.validation.tooSmall', params };
    }
    case 'too_big': {
      const params: DomainErrorParams = { field };
      const maximum = toParam((issue as { maximum?: unknown }).maximum);
      if (maximum !== undefined) params.maximum = maximum;
      return { messageKey: 'errors.validation.tooBig', params };
    }
    case 'invalid_format':
    case 'invalid_string':
      return {
        messageKey: 'errors.validation.invalidFormat',
        params: { field },
      };
    case 'invalid_value':
    case 'invalid_enum_value':
      return {
        messageKey: 'errors.validation.invalidValue',
        params: { field },
      };
    default:
      return { messageKey: 'errors.validation.invalid', params: { field } };
  }
}

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      const message = issue
        ? issue.path.length > 0
          ? `${issue.path.join('.')}: ${issue.message}`
          : issue.message
        : 'Invalid input data';
      const options = issue
        ? mapIssue(issue)
        : {
            messageKey: 'errors.validation.invalid',
            params: { field: 'body' },
          };
      throw new BadRequestError(message, options);
    }
    return result.data;
  }
}
