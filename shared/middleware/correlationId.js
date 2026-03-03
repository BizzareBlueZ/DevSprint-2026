/**
 * Correlation ID Middleware
 * Copy this to each service's middleware/ folder
 * Generates or propagates trace IDs for distributed tracing
 */
const { v4: uuidv4 } = require('uuid')

const CORRELATION_HEADERS = ['x-correlation-id', 'x-request-id', 'x-trace-id']

function correlationIdMiddleware(req, res, next) {
  let correlationId = null
  for (const header of CORRELATION_HEADERS) {
    if (req.headers[header]) {
      correlationId = req.headers[header]
      break
    }
  }

  if (!correlationId) {
    correlationId = uuidv4()
  }

  req.correlationId = correlationId
  res.setHeader('x-correlation-id', correlationId)
  next()
}

function getCorrelationHeaders(req) {
  return { 'x-correlation-id': req.correlationId }
}

module.exports = { correlationIdMiddleware, getCorrelationHeaders, CORRELATION_HEADERS }
