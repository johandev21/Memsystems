import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { DomainError } from '../errors/domain-error';
import type { DomainErrorParams } from '../errors/domain-error';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (response.headersSent) {
      this.logger.error(
        'Exception thrown after response headers sent; aborting response.',
        exception instanceof Error ? exception.stack : undefined,
      );
      response.destroy();
      return;
    }

    if (exception instanceof DomainError) {
      const error = exception.messageKey ?? exception.message;
      const payload: {
        error: string;
        code: string;
        params?: DomainErrorParams;
      } = { error, code: exception.code };
      if (Object.keys(exception.params).length > 0) {
        payload.params = exception.params;
      }
      this.logger.warn(`DomainError [${exception.code}]: ${error}`);
      return response.status(exception.status).json(payload);
    }

    if (exception instanceof MulterError) {
      const isTooLarge = exception.code === 'LIMIT_FILE_SIZE';
      return response.status(isTooLarge ? 413 : 400).json({
        error: isTooLarge
          ? 'Uploaded file exceeds the maximum size of 50 MB'
          : 'Invalid file upload',
        code: isTooLarge ? 'upload_too_large' : 'upload_invalid',
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as
        string | { message?: string | string[] };
      const message =
        typeof res === 'string' ? res : (res.message ?? exception.message);
      return response.status(status).json({
        error: Array.isArray(message) ? message.join(', ') : message,
        code: 'http_exception',
      });
    }

    const err =
      exception instanceof Error ? exception : new Error('Unknown error');
    const safeMessage = redactSensitiveDetails(err.message);
    const safeStack = err.stack ? redactSensitiveDetails(err.stack) : undefined;
    this.logger.error(`Unhandled Exception: ${safeMessage}`, safeStack);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      code: 'internal_error',
    });
  }
}

function redactSensitiveDetails(value: string): string {
  return value
    .replace(
      /params:\s*[\s\S]*?(?=\n(?:Error:|\s*at\s)|$)/i,
      'params: [REDACTED]',
    )
    .replace(/(sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,})/g, '[REDACTED_KEY]');
}
