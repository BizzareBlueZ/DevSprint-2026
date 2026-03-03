/**
 * Order Gateway - Main Entry Point
 * Refactored into modular routes, middleware, and services
 */
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const pool = require('./db')
const { logger } = require('./lib/logger')

// ─── Environment Validation ────────────────────────────────────
if (!process.env.JWT_SECRET) {
  logger.fatal('FATAL: JWT_SECRET environment variable is not set. Refusing to start.')
  process.exit(1)
}
if (!process.env.RABBITMQ_URL) {
  logger.fatal('FATAL: RABBITMQ_URL environment variable is not set. Refusing to start.')
  process.exit(1)
}

const STOCK_SERVICE_URL = process.env.STOCK_SERVICE_URL || 'http://localhost:3002'
const NOTIFICATION_HUB_URL = process.env.NOTIFICATION_HUB_URL || 'http://localhost:3004'
const RABBITMQ_URL = process.env.RABBITMQ_URL
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const app = express()

// ─── Redis Connection ──────────────────────────────────────────
let redisClient = null
try {
  const Redis = require('ioredis')
  redisClient = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false })
  redisClient
    .connect()
    .then(() => logger.info('Connected to Redis'))
    .catch(() => {
      logger.warn('Redis not available - cache disabled')
      redisClient = null
    })
} catch {
  logger.warn('Redis not available - cache disabled')
}

// ─── RabbitMQ Connection ───────────────────────────────────────
let rabbitChannel = null
async function connectRabbitMQ() {
  try {
    const amqp = require('amqplib')
    const conn = await amqp.connect(RABBITMQ_URL)
    rabbitChannel = await conn.createChannel()
    await rabbitChannel.assertQueue('orders', { durable: true })
    logger.info('Connected to RabbitMQ')
  } catch {
    logger.warn('RabbitMQ not available - orders will be processed directly')
  }
}
connectRabbitMQ()

// ─── Kitchen Simulator ─────────────────────────────────────────
const { createKitchenSimulator } = require('./services/kitchen')
const { simulateKitchen } = createKitchenSimulator(pool, NOTIFICATION_HUB_URL)

// ─── Global Middleware ─────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost'], credentials: true }))
app.use(express.json())

// Correlation ID middleware (for distributed tracing)
const { correlationIdMiddleware } = require('./middleware/correlationId')
app.use(correlationIdMiddleware)

// Request logging middleware
const { requestLoggerMiddleware } = require('./middleware/requestLogger')
app.use(requestLoggerMiddleware)

// Chaos middleware (for testing resilience)
const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

// ─── Route Modules ─────────────────────────────────────────────
const createMenuRoutes = require('./routes/menu')
const createOrderRoutes = require('./routes/orders')
const createWalletRoutes = require('./routes/wallet')
const createCafeteriaRoutes = require('./routes/cafeteria')
const createAdminRoutes = require('./routes/admin')
const createReviewRoutes = require('./routes/reviews')
const createHealthRoutes = require('./routes/health')

// Dependencies to pass to route factories
const routeDeps = {
  redisClient,
  get rabbitChannel() {
    return rabbitChannel
  },
  simulateKitchen,
  STOCK_SERVICE_URL,
}

// Mount routes
app.use('/menu', createMenuRoutes(pool))
app.use('/orders', createOrderRoutes(pool, routeDeps))
app.use('/wallet', createWalletRoutes(pool))
app.use('/cafeteria', createCafeteriaRoutes(pool))
app.use('/admin', createAdminRoutes(pool, routeDeps))
app.use('/reviews', createReviewRoutes(pool))
app.use('/', createHealthRoutes(pool, routeDeps))

// ─── Database Connection Check ─────────────────────────────────
pool
  .query('SELECT 1')
  .then(() => logger.info('Connected to PostgreSQL'))
  .catch(err => logger.error({ error: err.message }, 'PostgreSQL connection failed'))

// ─── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info({ port: PORT }, `Order Gateway running on http://localhost:${PORT}`)
})

module.exports = app
