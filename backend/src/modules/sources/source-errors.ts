import { BadRequestError } from '../../common/errors/domain-error';

export type WebScrapeErrorCode =
  | 'invalid_url'
  | 'blocked_url'
  | 'fetch_failed'
  | 'timeout'
  | 'redirect_limit'
  | 'response_too_large'
  | 'invalid_content_type'
  | 'robots_denied'
  | 'not_readerable'
  | 'extraction_failed'
  | 'unauthorized'
  | 'rate_limited';

export class WebScrapeError extends BadRequestError {
  constructor(
    message: string,
    public readonly code: WebScrapeErrorCode,
  ) {
    super(message);
    this.name = 'WebScrapeError';
  }
}
