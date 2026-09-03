/**
 * Maps AI Gateway / AI SDK failures to stable, user-facing categories.
 * Reads `type`/`statusCode`/`isRetryable` when present (GatewayError shape)
 * and falls back to status codes and stable message phrases. AI SDK retry
 * wrappers ("Failed after N attempts…") are unwrapped to the last error.
 */
export type GatewayFailureKind =
  'auth' | 'entitlement' | 'rate_limited' | 'retired' | 'transient' | 'unknown';

export interface ClassifiedGatewayError {
  kind: GatewayFailureKind;
  retryable: boolean;
  statusCode?: number;
  detail: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unwrapRetryError(error: unknown): unknown {
  let current = error;
  for (let depth = 0; depth < 3; depth++) {
    if (current && typeof current === 'object' && 'lastError' in current) {
      const next: unknown = current.lastError;
      if (!next) break;
      current = next;
      continue;
    }
    // AI SDK RetryError message shape: "Failed after N attempts. Last error: <cause>"
    if (
      current instanceof Error &&
      /failed after \d+ attempts/i.test(current.message)
    ) {
      const cause = (current as { cause?: unknown }).cause;
      if (cause) {
        current = cause;
        continue;
      }
    }
    break;
  }
  return current;
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number') return status;
    const nested = (error as { status?: unknown }).status;
    if (typeof nested === 'number') return nested;
  }
  return undefined;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

export function classifyGatewayError(error: unknown): ClassifiedGatewayError {
  const root = unwrapRetryError(error);
  const message = errorMessage(root);
  const statusCode = statusOf(root);
  const name = errorName(root);
  const retryableFlag =
    root && typeof root === 'object' && 'isRetryable' in root
      ? (root as { isRetryable?: unknown }).isRetryable === true
      : undefined;

  const detail =
    message.length > 500
      ? `${message.slice(0, 500)}…`
      : message || 'Unknown error';

  if (
    statusCode === 401 ||
    /authentication|invalid api key|unauthorized|incorrect api key/i.test(
      `${name} ${message}`,
    )
  ) {
    return { kind: 'auth', retryable: false, statusCode, detail };
  }
  if (
    statusCode === 403 ||
    /do not have access|not have access|entitlement|forbidden|upgrade to paid/i.test(
      message,
    )
  ) {
    return { kind: 'entitlement', retryable: false, statusCode, detail };
  }
  if (
    statusCode === 429 ||
    /rate.?limit|too many requests|quota exceeded/i.test(`${name} ${message}`)
  ) {
    return { kind: 'rate_limited', retryable: true, statusCode, detail };
  }
  if (
    statusCode === 404 ||
    /model not found|no such model|model .* (retired|deprecated|removed)/i.test(
      message,
    )
  ) {
    return { kind: 'retired', retryable: false, statusCode, detail };
  }
  if (
    retryableFlag === true ||
    (statusCode !== undefined && statusCode >= 500) ||
    /timeout|timed out|temporarily|try again|econnreset|socket hang up|fetch failed/i.test(
      message,
    )
  ) {
    return { kind: 'transient', retryable: true, statusCode, detail };
  }
  return {
    kind: 'unknown',
    retryable: retryableFlag ?? false,
    statusCode,
    detail,
  };
}
