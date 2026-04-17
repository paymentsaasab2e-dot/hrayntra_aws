import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
});

export default logger;
