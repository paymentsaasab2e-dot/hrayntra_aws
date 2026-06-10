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

  if (error && typeof error === 'object' && (error as Error).name === 'AbortError') {
    return new ApiRequestError('Request was cancelled.', {
      kind: 'abort',
      retryable: false,
      cause: error,
    });
  }

  const message = String((error as Error)?.message || '').toLowerCase();
  const name = String((error as Error)?.name || '');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ApiRequestError('You appear to be offline. Reconnect and retry.', {
      kind: 'offline',
      retryable: true,
      cause: error,
    });
  }

  if (/timeout|timed out|etimedout/i.test(message)) {
    return new ApiRequestError('Request timed out. The server may be busy — retrying can help.', {
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
    const isLocalDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.local'));
    const friendly = isLocalDev
      ? 'Backend unreachable — the API on port 5001 may be restarting or overloaded. Retrying…'
      : 'Network error — could not reach the server. The API may be busy; retrying…';
    return new ApiRequestError(friendly, { kind: 'network', retryable: true, cause: error });
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
  const retryable = isRetryableHttpStatus(status);
  let friendly = message || `Request failed with status ${status}`;

  if (status === 502) {
    friendly = 'Bad gateway (502) — the API proxy could not reach the server. Retry in a moment.';
  } else if (status === 503) {
    friendly = 'Service unavailable (503) — the server is temporarily overloaded. Retry shortly.';
  } else if (status === 504) {
    friendly = 'Gateway timeout (504) — the request took too long. Retry this file.';
  } else if (status === 408) {
    friendly = 'Request timeout (408). Retry this file.';
  } else if (status === 429) {
    friendly = 'Too many requests (429). Waiting before retry.';
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

export function normalizeInvalidResponseError(status?: number): ApiRequestError {
  const retryable = typeof status === 'number' && isRetryableHttpStatus(status);
  const message =
    status === 502 || status === 503 || status === 504
      ? `Gateway error (${status}) — received an invalid response. Retry in a moment.`
      : 'Invalid server response — the API returned unexpected output.';

  return new ApiRequestError(message, {
    status,
    kind: 'invalid_response',
    retryable,
  });
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

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error || 'Request failed');
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
