/**
 * Structured Logger - stock-service
 */
const pino = require('pino')

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: label => ({ level: label }),
    bindings: () => ({ service: 'stock-service' }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
})

function withCorrelationId(correlationId) {
  return logger.child({ correlationId })
}

function forRequest(req) {
  return logger.child({ correlationId: req.correlationId, method: req.method, path: req.path })
}

module.exports = { logger, withCorrelationId, forRequest }
