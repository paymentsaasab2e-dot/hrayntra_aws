import pinoHttp from 'pino-http';
import logger from '../utils/logger.js';

export const requestLoggerMiddleware = pinoHttp({
  logger,
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        route: req.url,
      };
    },
    res(res) {
      return {
        status: res.statusCode,
      };
    },
  },
  customSuccessMessage(req, res) {
    const startedAt = Number(req._requestStartedAt || Date.now());
    const duration = Date.now() - startedAt;
    return JSON.stringify({
      method: req.method,
      route: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  },
  customErrorMessage(req, _res, err) {
    return JSON.stringify({
      level: 'error',
      message: err?.message || 'Unhandled error',
      route: req.originalUrl || req.url,
    });
  },
});

export function responseTimingMiddleware(req, res, next) {
  req._requestStartedAt = Date.now();
  next();
}
