/**
 * Database Configuration with Production-Ready Pooling
 *
 * Pool sizing guidance:
 * - max: Number of connections in pool. Rule of thumb: (cores * 2) + spindle_count
 *   For cloud deployments, start with 10-20 and monitor
 * - min: Minimum connections to keep alive. Keep low in dev, higher in production
 * - idleTimeoutMillis: How long a client can sit idle before being closed
 * - connectionTimeoutMillis: How long to wait for a connection before erroring
 * - statement_timeout: Prevents runaway queries from hogging connections
 */
const { Pool } = require('pg')

/**
 * Create a configured database pool
 * @param {object} options - Override options
 * @param {object} logger - Logger instance (optional)
 */
function createPool(options = {}, logger = console) {
  const isProduction = process.env.NODE_ENV === 'production'

  const config = {
    // Connection settings
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'cafeteria',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'secret123',

    // Pool sizing
    max: parseInt(process.env.DB_POOL_MAX) || (isProduction ? 20 : 10),
    min: parseInt(process.env.DB_POOL_MIN) || (isProduction ? 5 : 2),

    // Timeouts
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // 30 seconds
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000, // 10 seconds

    // Query timeout (kills queries that run too long)
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000, // 30 seconds

    // SSL configuration for production
    ...(isProduction &&
      process.env.DB_SSL !== 'false' && {
        ssl: {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      }),

    // Application name for monitoring
    application_name: process.env.SERVICE_NAME || 'cafeteria-service',

    // Override with custom options
    ...options,
  }

  const pool = new Pool(config)

  // Event handlers for monitoring
  pool.on('connect', client => {
    logger.debug(
      { totalCount: pool.totalCount, idleCount: pool.idleCount },
      'New database connection'
    )

    // Set statement timeout per connection
    client.query(`SET statement_timeout = ${config.statement_timeout}`)
  })

  pool.on('acquire', () => {
    logger.debug(
      { totalCount: pool.totalCount, idleCount: pool.idleCount, waitingCount: pool.waitingCount },
      'Connection acquired'
    )
  })

  pool.on('remove', () => {
    logger.debug({ totalCount: pool.totalCount }, 'Connection removed from pool')
  })

  pool.on('error', (err, client) => {
    logger.error({ error: err.message }, 'Unexpected database error')
  })

  // Health check helper
  pool.healthCheck = async () => {
    const start = Date.now()
    try {
      await pool.query('SELECT 1')
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        stats: {
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingClients: pool.waitingCount,
        },
      }
    } catch (err) {
      return {
        healthy: false,
        error: err.message,
        latencyMs: Date.now() - start,
      }
    }
  }

  return pool
}

/**
 * Pool statistics for monitoring
 */
function getPoolStats(pool) {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  }
}

module.exports = { createPool, getPoolStats }
