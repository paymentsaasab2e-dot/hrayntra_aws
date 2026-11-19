type LogLevel = 'INFO' | 'WARN' | 'ERROR'

type LogMeta = Record<string, unknown>

function write(level: LogLevel, event: string, meta: LogMeta = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...meta
  }
  const line = JSON.stringify(payload)
  if (level === 'ERROR') {
    console.error(line)
    return
  }
  if (level === 'WARN') {
    console.warn(line)
    return
  }
  console.log(line)
}

export const logger = {
  info: (event: string, meta?: LogMeta) => write('INFO', event, meta),
  warn: (event: string, meta?: LogMeta) => write('WARN', event, meta),
  error: (event: string, meta?: LogMeta) => write('ERROR', event, meta),
}

