/**
 * Structured Logger using Pino
 * Provides JSON-formatted logs with correlation ID support for distributed tracing
 */
const pino = require('pino')

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: label => ({ level: label }),
    bindings: () => ({ service: 'order-gateway' }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // In production, logs are JSON; in development, use pretty printing
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
})

/**
 * Create a child logger with correlation ID bound
 * @param {string} correlationId - The trace/correlation ID
 * @returns {pino.Logger} Child logger with correlationId bound
 */
function withCorrelationId(correlationId) {
  return logger.child({ correlationId })
}

/**
 * Create a child logger for a specific request
 * @param {object} req - Express request object
 * @returns {pino.Logger} Child logger with request context
 */
function forRequest(req) {
  return logger.child({
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent'),
    ip: req.ip,
  })
}

module.exports = {
  logger,
  withCorrelationId,
  forRequest,
}
