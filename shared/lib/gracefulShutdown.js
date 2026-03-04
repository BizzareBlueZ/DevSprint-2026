/**
 * Graceful Shutdown Handler
 * Properly drains connections on SIGTERM/SIGINT
 */

const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT_MS) || 30000

function gracefulShutdown(server, options = {}) {
  const { logger = console, onShutdown } = options
  let isShuttingDown = false

  const shutdown = async signal => {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.info({ signal }, 'Shutdown signal received, draining connections...')

    server.close(async err => {
      if (err) logger.error({ error: err.message }, 'Error closing server')

      if (onShutdown) {
        try {
          await onShutdown()
          logger.info('Cleanup completed')
        } catch (cleanupErr) {
          logger.error({ error: cleanupErr.message }, 'Cleanup error')
        }
      }

      logger.info('Server closed gracefully')
      process.exit(0)
    })

    setTimeout(() => {
      logger.warn('Shutdown timeout exceeded, forcing exit')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', err => {
    logger.fatal({ error: err.message, stack: err.stack }, 'Uncaught exception')
    shutdown('uncaughtException')
  })
  process.on('unhandledRejection', reason => {
    logger.fatal({ reason: String(reason) }, 'Unhandled rejection')
    shutdown('unhandledRejection')
  })
}

module.exports = { gracefulShutdown, SHUTDOWN_TIMEOUT }
