const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { Pool } = require('pg')
const app = express()

// ─── Observability ─────────────────────────────────────────────
const { logger } = require('./lib/logger')
const {
  incCounter,
  observeHistogram,
  toPrometheusFormat,
  toJSON,
  METRICS,
} = require('./lib/metrics')
const { correlationIdMiddleware } = require('./middleware/correlationId')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'cafeteria',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'secret123',
})

pool.connect((err, client, release) => {
  if (err) logger.error({ error: err.message }, 'DB connection failed')
  else {
    logger.info('Connected to PostgreSQL')
    release()
  }
})

// ─── Redis (optional) ──────────────────────────────────────────
let redisClient = null
try {
  const Redis = require('ioredis')
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    enableOfflineQueue: false,
  })
  redisClient
    .connect()
    .then(() => logger.info('Connected to Redis'))
    .catch(() => {
      logger.warn('Redis not available')
      redisClient = null
    })
} catch {
  logger.warn('Redis not available')
}

// ─── Metrics ───────────────────────────────────────────────────
const metrics = { totalOrders: 0, failureCount: 0, totalLatency: 0, requestCount: 0 }

app.use(cors())
app.use(express.json())
app.use(correlationIdMiddleware)

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

// ─── GET /stock/:itemId — get current stock level ──────────────
app.get('/stock/:itemId', async (req, res) => {
  const { itemId } = req.params
  try {
    // Check Redis cache first
    if (redisClient) {
      const cached = await redisClient.get(`stock:${itemId}`).catch(() => null)
      if (cached !== null) {
        return res.json({ itemId, quantity: parseInt(cached), source: 'cache' })
      }
    }
    const result = await pool.query('SELECT quantity FROM inventory.stock WHERE item_id = $1', [
      itemId,
    ])
    if (result.rows.length === 0) return res.status(404).json({ message: 'Item not found.' })
    const quantity = result.rows[0].quantity

    // Cache the result
    if (redisClient) await redisClient.set(`stock:${itemId}`, quantity, 'EX', 60).catch(() => {})

    res.json({ itemId, quantity, source: 'database' })
  } catch (err) {
    logger.error(
      { correlationId: req.correlationId, error: err.message, itemId },
      'Stock fetch error'
    )
    res.status(500).json({ message: 'Failed to fetch stock.' })
  }
})

// ─── POST /stock/:itemId/decrement — optimistic locking decrement
// Accepts optional orderId in body for idempotent stock deduction.
// If orderId is provided and this decrement was already processed,
// returns success without decrementing again.
app.post('/stock/:itemId/decrement', async (req, res) => {
  const start = Date.now()
  const { itemId } = req.params
  const { orderId } = req.body || {}
  const MAX_RETRIES = 3

  // Idempotency: if orderId provided, check Redis for prior processing
  if (orderId && redisClient) {
    const alreadyProcessed = await redisClient.get(`decrement:${orderId}`).catch(() => null)
    if (alreadyProcessed) {
      return res
        .status(200)
        .json({ message: 'Stock already decremented for this order.', idempotent: true })
    }
  }

  // Check Redis cache first — fast rejection if out of stock
  if (redisClient) {
    const cached = await redisClient.get(`stock:${itemId}`).catch(() => null)
    if (cached === '0') {
      metrics.failureCount++
      return res.status(409).json({ message: 'Out of stock.' })
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Get current stock with version (optimistic locking)
      const current = await pool.query(
        'SELECT quantity, version FROM inventory.stock WHERE item_id = $1',
        [itemId]
      )

      if (current.rows.length === 0) {
        return res.status(404).json({ message: 'Item not found in stock.' })
      }

      const { quantity, version } = current.rows[0]

      if (quantity <= 0) {
        // Update cache to reflect zero stock
        if (redisClient) await redisClient.set(`stock:${itemId}`, 0, 'EX', 60).catch(() => {})
        metrics.failureCount++
        return res.status(409).json({ message: 'Out of stock.' })
      }

      // Attempt atomic decrement — only succeeds if version hasn't changed
      const update = await pool.query(
        `UPDATE inventory.stock
                 SET quantity = quantity - 1, version = version + 1, updated_at = NOW()
                 WHERE item_id = $1 AND version = $2 AND quantity > 0
                     RETURNING quantity`,
        [itemId, version]
      )

      if (update.rowCount === 0) {
        // Version mismatch — another request got there first, retry
        continue
      }

      const newQuantity = update.rows[0].quantity

      // Update Redis cache with new quantity
      if (redisClient) {
        await redisClient.set(`stock:${itemId}`, newQuantity, 'EX', 60).catch(() => {})
        // Mark this orderId as processed for idempotency
        if (orderId) await redisClient.set(`decrement:${orderId}`, '1', 'EX', 3600).catch(() => {})
      }

      metrics.totalOrders++
      metrics.requestCount++
      metrics.totalLatency += Date.now() - start

      return res.status(200).json({ message: 'Stock decremented.', newQuantity })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message, itemId, attempt: attempt + 1 },
        'Stock decrement error'
      )
      if (attempt === MAX_RETRIES - 1) {
        metrics.failureCount++
        return res.status(500).json({ message: 'Failed to decrement stock.' })
      }
    }
  }

  metrics.failureCount++
  return res.status(409).json({ message: 'Stock update conflict. Please try again.' })
})

// ─── GET /admin/stock — list all stock with alerts ────────────
app.get('/admin/stock', async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 10
  try {
    const result = await pool.query(
      `
            SELECT s.item_id, s.quantity, s.version, s.updated_at,
                   m.name, m.category, m.price, m.is_available,
                   CASE WHEN s.quantity <= $1 THEN true ELSE false END as low_stock
            FROM inventory.stock s
            JOIN public.menu_items m ON m.id = s.item_id
            ORDER BY s.quantity ASC
        `,
      [threshold]
    )

    const lowStockItems = result.rows.filter(r => r.low_stock)

    res.json({
      items: result.rows,
      alerts: lowStockItems,
      alertCount: lowStockItems.length,
      threshold,
    })
  } catch (err) {
    logger.error(
      { correlationId: req.correlationId, error: err.message },
      'Admin stock fetch error'
    )
    res.status(500).json({ message: 'Failed to fetch stock data.' })
  }
})

// ─── GET /admin/stock/alerts — get low stock alerts only ──────
app.get('/admin/stock/alerts', async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 10
  try {
    const result = await pool.query(
      `
            SELECT s.item_id, s.quantity, m.name, m.category, m.price
            FROM inventory.stock s
            JOIN public.menu_items m ON m.id = s.item_id
            WHERE s.quantity <= $1
            ORDER BY s.quantity ASC
        `,
      [threshold]
    )

    res.json({
      alerts: result.rows,
      count: result.rows.length,
      threshold,
      message:
        result.rows.length > 0
          ? `${result.rows.length} item(s) below threshold of ${threshold}`
          : 'All stock levels are healthy',
    })
  } catch (err) {
    logger.error({ correlationId: req.correlationId, error: err.message }, 'Stock alerts error')
    res.status(500).json({ message: 'Failed to fetch stock alerts.' })
  }
})

// ─── PUT /admin/stock/:itemId — set stock quantity ────────────
app.put('/admin/stock/:itemId', async (req, res) => {
  const { itemId } = req.params
  const { quantity } = req.body
  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({ message: 'Valid quantity is required.' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO inventory.stock (item_id, quantity, version) VALUES ($1, $2, 1)
             ON CONFLICT (item_id) DO UPDATE SET quantity = $2, version = inventory.stock.version + 1, updated_at = NOW()
             RETURNING *`,
      [itemId, parseInt(quantity)]
    )
    // Invalidate Redis cache
    if (redisClient) await redisClient.set(`stock:${itemId}`, quantity, 'EX', 60).catch(() => {})
    res.json({ message: 'Stock updated.', stock: result.rows[0] })
  } catch (err) {
    logger.error({ correlationId: req.correlationId, error: err.message }, 'Update stock error')
    res.status(500).json({ message: 'Failed to update stock.' })
  }
})

// ─── GET /health ───────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const deps = { database: 'connected', redis: 'connected' }
  try {
    await pool.query('SELECT 1')
  } catch {
    deps.database = 'disconnected'
  }
  if (redisClient) {
    try {
      await redisClient.ping()
    } catch {
      deps.redis = 'disconnected'
    }
  } else {
    deps.redis = 'not_configured'
  }
  const healthy = deps.database === 'connected'
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    service: 'stock-service',
    dependencies: deps,
    timestamp: new Date().toISOString(),
  })
})

// ─── GET /metrics ──────────────────────────────────────────────
app.get('/metrics', (req, res) => {
  const metricsData = toJSON()
  metricsData.uptime = process.uptime()
  // Dashboard-compatible fields
  metricsData.totalOrders = metrics.totalOrders
  metricsData.failureCount = metrics.failureCount
  metricsData.averageLatencyMs =
    metrics.requestCount > 0 ? Math.round(metrics.totalLatency / metrics.requestCount) : 0
  res.json(metricsData)
})

// ─── GET /metrics/prometheus ───────────────────────────────────
app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(toPrometheusFormat())
})

const { gracefulShutdown } = require('./lib/gracefulShutdown')

const PORT = process.env.PORT || 3002
const server = app.listen(PORT, () => logger.info({ port: PORT }, 'Stock Service started'))

gracefulShutdown(server, {
  logger,
  onShutdown: async () => {
    await pool.end()
    if (redisClient) await redisClient.quit().catch(() => {})
  },
})

module.exports = { app, pool }
