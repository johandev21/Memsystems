import i18n from "@/shared/i18n/i18n";

type DynamicTranslate = (key: string, options?: Record<string, string | number>) => string;

const translateDynamic = i18n.t as unknown as DynamicTranslate;

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  statusCode?: number;
  code?: string;
  params?: Record<string, string | number>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function createApiErrorMessage(res: Response, fallback?: string): string {
  if (fallback) return fallback;
  return `Request failed (${res.status})`;
}

export function resolveApiErrorMessage(data: ApiErrorResponse, fallback: string): string {
  const key = data.error;
  if (!key) return fallback;
  if (!i18n.exists(key)) return key;
  return translateDynamic(key, data.params);
}

export function resolveDynamicMessage(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!i18n.exists(value)) return value;
  return translateDynamic(value);
}
