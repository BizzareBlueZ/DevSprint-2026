/**
 * Correlation ID Middleware
 * Generates or propagates a unique trace ID across service requests
 * for distributed tracing and log correlation
 */
const { v4: uuidv4 } = require('uuid')

// Header names for correlation ID propagation
const CORRELATION_HEADERS = ['x-correlation-id', 'x-request-id', 'x-trace-id']

/**
 * Middleware that extracts or generates a correlation ID for each request
 * The ID is attached to req.correlationId and included in response headers
 */
function correlationIdMiddleware(req, res, next) {
  // Try to extract from incoming headers (propagated from upstream service)
  let correlationId = null
  for (const header of CORRELATION_HEADERS) {
    if (req.headers[header]) {
      correlationId = req.headers[header]
      break
    }
  }

  // Generate new ID if none provided
  if (!correlationId) {
    correlationId = uuidv4()
  }

  // Attach to request object for use in handlers and logging
  req.correlationId = correlationId

  // Include in response headers for client-side debugging
  res.setHeader('x-correlation-id', correlationId)

  next()
}

/**
 * Helper to propagate correlation ID in outgoing HTTP requests
 * @param {object} req - Express request object with correlationId
 * @returns {object} Headers object to spread into axios/fetch config
 */
function getCorrelationHeaders(req) {
  return {
    'x-correlation-id': req.correlationId,
  }
}

module.exports = {
  correlationIdMiddleware,
  getCorrelationHeaders,
  CORRELATION_HEADERS,
}
