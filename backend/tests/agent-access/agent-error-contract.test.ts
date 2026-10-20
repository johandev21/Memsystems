import {
  HttpException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DomainExceptionFilter } from '../../src/common/filters/domain-exception.filter';
import { invalidAgentKeyError } from '../../src/modules/agent-access/agent-key.guard';

describe('Agent error contract', () => {
  it('forwards the Agent guard body without wrapping it', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { headersSent: false, status };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;

    new DomainExceptionFilter().catch(
      new HttpException(
        invalidAgentKeyError('Invalid Agent Key'),
        HttpStatus.UNAUTHORIZED,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Invalid Agent Key',
      code: 'agent_key_invalid',
    });
  });
});
