export type DomainErrorOptions = {
  cause?: Error;
  internalMessage?: string;
};

export class DomainError extends Error {
  public readonly internalMessage?: string;

  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    options?: DomainErrorOptions,
  ) {
    super(message, { cause: options?.cause });
    this.name = 'DomainError';
    this.internalMessage = options?.internalMessage;
  }
}

export class InternalError extends DomainError {
  constructor(message = 'Internal server error', options?: DomainErrorOptions) {
    super(message, 500, 'internal_error', options);
    this.name = 'InternalError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'not_found');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'forbidden');
    this.name = 'ForbiddenError';
  }
}

export class BadRequestError extends DomainError {
  constructor(message = 'Bad request') {
    super(message, 400, 'bad_request');
    this.name = 'BadRequestError';
  }
}

export class ServiceUnavailableError extends DomainError {
  constructor(message = 'Service unavailable', options?: DomainErrorOptions) {
    super(message, 503, 'service_unavailable', options);
    this.name = 'ServiceUnavailableError';
  }
}
