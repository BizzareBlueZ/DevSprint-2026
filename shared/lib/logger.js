/**
 * Shared Logger Module
 * Copy this to each service's lib/ folder or publish as internal package
 * Provides structured JSON logging with correlation ID support
 */
const pino = require('pino')

function createLogger(serviceName) {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: label => ({ level: label }),
      bindings: () => ({ service: serviceName }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
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
}

function withCorrelationId(logger, correlationId) {
  return logger.child({ correlationId })
}

function forRequest(logger, req) {
  return logger.child({
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
  })
}

module.exports = { createLogger, withCorrelationId, forRequest }
