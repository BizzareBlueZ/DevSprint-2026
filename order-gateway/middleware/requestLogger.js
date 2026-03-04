/**
 * Request Logger Middleware
 * Logs incoming requests and responses with structured JSON output
 */
// eslint-disable-next-line no-unused-vars
const { forRequest, logger } = require('../lib/logger')
const { incCounter, observeHistogram, METRICS } = require('../lib/metrics')

/**
 * Middleware that logs request/response details and records metrics
 */
function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now()

  // Log incoming request
  const reqLogger = forRequest(req)
  reqLogger.info({ event: 'request_start' }, `${req.method} ${req.path}`)

  // Capture original end to log response
  const originalEnd = res.end
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime
    const statusCode = res.statusCode

    // Record metrics
    incCounter(METRICS.HTTP_REQUESTS_TOTAL, {
      method: req.method,
      path: req.route?.path || req.path,
      status: statusCode,
    })
    observeHistogram(METRICS.HTTP_REQUEST_DURATION_MS, duration, {
      method: req.method,
      path: req.route?.path || req.path,
    })

    // Log response
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    reqLogger[level](
      {
        event: 'request_end',
        statusCode,
        durationMs: duration,
        correlationId: req.correlationId,
      },
      `${req.method} ${req.path} ${statusCode} ${duration}ms`
    )

    originalEnd.call(this, chunk, encoding)
  }

  next()
}

module.exports = { requestLoggerMiddleware }
