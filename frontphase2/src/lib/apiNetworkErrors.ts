import {
  CONNECTION_STATUS,
  formatPortalStatusLine,
  type PortalStatusCopy,
} from './portalStatusCopy';

export type ApiErrorKind =
  | 'abort'
  | 'timeout'
  | 'network'
  | 'offline'
  | 'http'
  | 'invalid_response'
  | 'unknown';

export type ApiRequestErrorOptions = {
  status?: number;
  kind?: ApiErrorKind;
  retryable?: boolean;
  cause?: unknown;
  data?: unknown;
  raw?: unknown;
  validationIssues?: string[];
};

export class ApiRequestError extends Error {
  status?: number;
  kind: ApiErrorKind;
  retryable: boolean;
  cause?: unknown;
  data?: unknown;
  raw?: unknown;
  validationIssues?: string[];

  constructor(message: string, options: ApiRequestErrorOptions = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.kind = options.kind ?? 'unknown';
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    this.data = options.data;
    this.raw = options.raw;
    this.validationIssues = options.validationIssues;
  }
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 502, 503, 504]);

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

export function normalizeFetchError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;

  if (error && typeof error === 'object' && (error as Error).name === 'TimeoutError') {
    return new ApiRequestError(formatPortalStatusLine(CONNECTION_STATUS.timeout), {
      kind: 'timeout',
      retryable: true,
      cause: error,
    });
  }

  if (error && typeof error === 'object' && (error as Error).name === 'AbortError') {
    const msg = String((error as Error).message || '').toLowerCase();
    if (/timeout|timed out/i.test(msg)) {
      return new ApiRequestError(formatPortalStatusLine(CONNECTION_STATUS.timeout), {
        kind: 'timeout',
        retryable: true,
        cause: error,
      });
    }
    return new ApiRequestError('Request was cancelled.', {
      kind: 'abort',
      retryable: false,
      cause: error,
    });
  }

  const message = String((error as Error)?.message || '').toLowerCase();
  const name = String((error as Error)?.name || '');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ApiRequestError(formatPortalStatusLine(CONNECTION_STATUS.offline), {
      kind: 'offline',
      retryable: true,
      cause: error,
    });
  }

  if (/timeout|timed out|etimedout/i.test(message)) {
    return new ApiRequestError(formatPortalStatusLine(CONNECTION_STATUS.timeout), {
      kind: 'timeout',
      retryable: true,
      cause: error,
    });
  }

  if (
    /failed to fetch|networkerror|load failed|err_connection|econnrefused|connection refused|network request failed|socket hang up|err_connection_reset|connection reset/i.test(
      message
    ) ||
    (name === 'TypeError' && message.includes('fetch'))
  ) {
    return new ApiRequestError(formatPortalStatusLine(CONNECTION_STATUS.failed), {
      kind: 'network',
      retryable: true,
      cause: error,
    });
  }

  return new ApiRequestError((error as Error)?.message || 'Unexpected network error.', {
    kind: 'unknown',
    retryable: false,
    cause: error,
  });
}

export function normalizeHttpError(
  status: number,
  message: string,
  meta: Omit<ApiRequestErrorOptions, 'status' | 'kind' | 'retryable'> = {}
): ApiRequestError {
  const lowerMessage = String(message || '').toLowerCase();
  const looksLikeUpstreamTimeout =
    /etimedout|timed out|querysrv etimeout|econnrefused|connection refused|mongodb\.net/.test(lowerMessage);
  const retryable = isRetryableHttpStatus(status) || looksLikeUpstreamTimeout;
  let friendly = message || CONNECTION_STATUS.failed.message;

  if (status === 429) {
    friendly = formatPortalStatusLine(CONNECTION_STATUS.rateLimit);
  } else if (status === 408 || status === 504) {
    friendly = formatPortalStatusLine(CONNECTION_STATUS.timeout);
  } else if (status === 502 || status === 503) {
    friendly = formatPortalStatusLine(CONNECTION_STATUS.failed);
  } else if (looksLikeUpstreamTimeout) {
    friendly = formatPortalStatusLine(CONNECTION_STATUS.timeout);
  }

  return new ApiRequestError(friendly, {
    status,
    kind: 'http',
    retryable,
    ...meta,
  });
}

export function createHttpApiError(
  status: number,
  message: string,
  meta: Omit<ApiRequestErrorOptions, 'status' | 'kind' | 'retryable'> = {}
): ApiRequestError {
  return normalizeHttpError(status, message, meta);
}

const PAYLOAD_TOO_LARGE_RE = /request entity too large|payload too large|body exceeded|entity too large|file too large|maximum.*size|413/i;

/**
 * A 413 (or a proxy/platform "Request Entity Too Large" plain-text body) is the
 * usual reason a JSON parse fails on an upload — surface something the user can
 * act on instead of the cryptic `Unexpected token 'R'...`.
 */
export function isPayloadTooLarge(status?: number, rawText?: string): boolean {
  if (status === 413) return true;
  return typeof rawText === 'string' && PAYLOAD_TOO_LARGE_RE.test(rawText);
}

export function normalizeInvalidResponseError(status?: number, rawText?: string): ApiRequestError {
  if (isPayloadTooLarge(status, rawText)) {
    return new ApiRequestError(
      'The file is too large to upload. Please attach a smaller file (under 4 MB) and try again.',
      { status: status ?? 413, kind: 'invalid_response', retryable: false },
    );
  }

  const retryable = typeof status === 'number' && isRetryableHttpStatus(status);
  const message = retryable
    ? formatPortalStatusLine(CONNECTION_STATUS.failed)
    : CONNECTION_STATUS.failed.message;

  return new ApiRequestError(message, {
    status,
    kind: 'invalid_response',
    retryable,
  });
}

/**
 * Read a fetch Response body as JSON without throwing the browser's cryptic
 * `Unexpected token 'R', "Request En"... is not valid JSON`. Reads the body as
 * text once, then parses. On non-JSON bodies it raises a friendly, actionable
 * ApiRequestError (payload-too-large aware).
 */
export async function readApiJson<T = unknown>(res: Response): Promise<T> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (error) {
    throw normalizeInvalidResponseError(res.status);
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    if (res.ok) return undefined as unknown as T;
    throw normalizeInvalidResponseError(res.status);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw normalizeInvalidResponseError(res.status, trimmed);
  }
}

export function isRetryableApiError(error: unknown): boolean {
  if (error instanceof ApiRequestError) return error.retryable;
  if (error && typeof error === 'object' && 'retryable' in error) {
    return Boolean((error as ApiRequestError).retryable);
  }
  const status = (error as { status?: number })?.status;
  if (typeof status === 'number' && isRetryableHttpStatus(status)) return true;
  if (error && typeof error === 'object' && (error as Error).name === 'AbortError') return false;
  return normalizeFetchError(error).retryable;
}

export function getApiErrorCopy(error: unknown): PortalStatusCopy {
  const err = error instanceof ApiRequestError ? error : normalizeFetchError(error);
  if (err.kind === 'offline') return CONNECTION_STATUS.offline;
  if (err.kind === 'timeout') return CONNECTION_STATUS.timeout;
  if (err.status === 429) return CONNECTION_STATUS.rateLimit;
  if (err.status === 408 || err.status === 504) return CONNECTION_STATUS.timeout;
  if (
    err.kind === 'network' ||
    err.status === 502 ||
    err.status === 503 ||
    (err.kind === 'http' && err.retryable) ||
    (err.kind === 'invalid_response' && err.retryable)
  ) {
    return CONNECTION_STATUS.failed;
  }
  return { title: CONNECTION_STATUS.failed.title, message: err.message };
}

export function getApiErrorMessage(error: unknown): string {
  const copy = getApiErrorCopy(error);
  if (error instanceof ApiRequestError) {
    if (
      error.kind === 'offline' ||
      error.kind === 'timeout' ||
      error.kind === 'network' ||
      error.retryable
    ) {
      return formatPortalStatusLine(copy);
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return formatPortalStatusLine(CONNECTION_STATUS.failed);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withApiRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    signal?: AbortSignal;
    onRetry?: (attempt: number, error: unknown) => void;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 1200;
  const shouldRetry = options.shouldRetry ?? isRetryableApiError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw normalizeFetchError(new DOMException('Aborted', 'AbortError'));
    }
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) throw error;
      options.onRetry?.(attempt, error);
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError;
}
