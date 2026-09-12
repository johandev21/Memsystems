import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestError,
  NotFoundError,
} from '../src/common/errors/domain-error';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

function createHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const destroy = vi.fn();
  const response = { headersSent: false, status, destroy };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  };
  return { host, status, json, destroy };
}

describe('DomainExceptionFilter message keys', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('returns the message key and params for translated domain errors', () => {
    const { host, status, json } = createHost();
    const filter = new DomainExceptionFilter();

    filter.catch(
      new BadRequestError('errors.generation.problemCount', {
        params: { min: 1, max: 30 },
      }),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'errors.generation.problemCount',
      code: 'bad_request',
      params: { min: 1, max: 30 },
    });
  });

  it('keeps plain messages for errors that are not translated yet', () => {
    const { host, json } = createHost();
    const filter = new DomainExceptionFilter();

    filter.catch(new BadRequestError('Legacy plain message'), host as never);

    expect(json).toHaveBeenCalledWith({
      error: 'Legacy plain message',
      code: 'bad_request',
    });
  });

  it('prefers the message key when composed messages stay as fallback', () => {
    const { host, json } = createHost();
    const filter = new DomainExceptionFilter();

    filter.catch(
      new NotFoundError('Generation request', {
        messageKey: 'errors.generation.requestNotFound',
      }),
      host as never,
    );

    expect(json).toHaveBeenCalledWith({
      error: 'errors.generation.requestNotFound',
      code: 'not_found',
    });
  });
});
