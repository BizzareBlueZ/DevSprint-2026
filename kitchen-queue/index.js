const express = require('express')
const axios = require('axios')
const cors = require('cors')
require('dotenv').config()

const { Pool } = require('pg')
const app = express()

// ─── Observability ─────────────────────────────────────────────
const { logger } = require('./lib/logger')
const {
  incCounter,
  setGauge,
  observeHistogram,
  toPrometheusFormat,
  toJSON,
  METRICS,
} = require('./lib/metrics')
const { correlationIdMiddleware, getCorrelationHeaders } = require('./middleware/correlationId')

app.use(cors())
app.use(express.json())
app.use(correlationIdMiddleware)

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

if (!process.env.RABBITMQ_URL) {
  logger.fatal('FATAL: RABBITMQ_URL environment variable is not set. Refusing to start.')
  process.exit(1)
}
const RABBITMQ_URL = process.env.RABBITMQ_URL
const NOTIFICATION_HUB_URL = process.env.NOTIFICATION_HUB_URL || 'http://localhost:3004'
const KITCHEN_MIN_MS = parseInt(process.env.KITCHEN_MIN_MS) || 3000
const KITCHEN_MAX_MS = parseInt(process.env.KITCHEN_MAX_MS) || 7000

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'cafeteria',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'secret123',
})

const metrics = { processed: 0, failed: 0, inProgress: 0 }
let rabbitConnected = false

async function notify(orderId, status, orderInfo = {}, studentId = null) {
  try {
    await pool.query(
      'UPDATE orders.orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
      [status, orderId]
    )
  } catch (err) {
    logger.error({ orderId, error: err.message }, 'DB update error')
  }
  try {
    await axios.post(
      `${NOTIFICATION_HUB_URL}/notify`,
      { orderId, status, orderInfo, studentId },
      { timeout: 2000 }
    )
  } catch {
    /* notification hub down - fault tolerant */
  }
}

async function processOrder(order) {
  const { orderId, studentId, itemName } = order
  const prepTime = KITCHEN_MIN_MS + Math.random() * (KITCHEN_MAX_MS - KITCHEN_MIN_MS)
  logger.info({ orderId, itemName, prepTimeMs: Math.round(prepTime) }, 'Cooking order')
  metrics.inProgress++
  setGauge(METRICS.ORDERS_IN_PROGRESS, metrics.inProgress)
  await notify(orderId, 'IN_KITCHEN', { itemName }, studentId)
  await new Promise(resolve => setTimeout(resolve, prepTime))
  await notify(orderId, 'READY', { itemName }, studentId)
  metrics.inProgress--
  setGauge(METRICS.ORDERS_IN_PROGRESS, metrics.inProgress)
  metrics.processed++
  incCounter(METRICS.ORDERS_PROCESSED)
  observeHistogram(METRICS.COOKING_DURATION_MS, prepTime)
  logger.info({ orderId }, 'Order READY')
}

async function startConsumer() {
  try {
    const amqp = require('amqplib')
    const conn = await amqp.connect(RABBITMQ_URL)
    const channel = await conn.createChannel()
    await channel.assertQueue('orders', { durable: true })
    channel.prefetch(5)
    rabbitConnected = true
    logger.info('Connected to RabbitMQ')
    channel.consume('orders', async msg => {
      if (!msg) return
      try {
        const order = JSON.parse(msg.content.toString())
        await processOrder(order)
        channel.ack(msg)
      } catch (err) {
        logger.error({ error: err.message }, 'Processing error')
        metrics.failed++
        incCounter(METRICS.ORDERS_FAILED)
        channel.nack(msg, false, false)
      }
    })
    conn.on('close', () => {
      rabbitConnected = false
      setTimeout(startConsumer, 5000)
    })
  } catch {
    rabbitConnected = false
    logger.warn('RabbitMQ not available - retrying in 5s...')
    setTimeout(startConsumer, 5000)
  }
}

app.get('/health', async (req, res) => {
  const deps = { database: 'connected', rabbitmq: rabbitConnected ? 'connected' : 'disconnected' }
  try {
    await pool.query('SELECT 1')
  } catch {
    deps.database = 'disconnected'
  }
  const healthy = deps.database === 'connected' && deps.rabbitmq === 'connected'
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    service: 'kitchen-queue',
    dependencies: deps,
    timestamp: new Date().toISOString(),
  })
})
app.get('/metrics', (req, res) => {
  const metricsData = toJSON()
  metricsData.uptime = process.uptime()
  // Dashboard-compatible fields
  metricsData.totalOrders = metrics.processed
  metricsData.failureCount = metrics.failed
  metricsData.averageLatencyMs = 0
  res.json(metricsData)
})
app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(toPrometheusFormat())
})

const { gracefulShutdown } = require('./lib/gracefulShutdown')

const PORT = process.env.PORT || 3003
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Kitchen Queue started')
  startConsumer()
})

gracefulShutdown(server, {
  logger,
  onShutdown: async () => {
    await pool.end()
  },
})
