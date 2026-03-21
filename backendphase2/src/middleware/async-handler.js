import { ZodError } from 'zod';

/**
 * Express wrapper: consistent JSON errors (no stack to client).
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} fn
 */
export function withErrorHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: err.errors,
        });
      }
      if (err?.message === 'Unauthorized') {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      console.error('[handler]', err?.message || err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}
