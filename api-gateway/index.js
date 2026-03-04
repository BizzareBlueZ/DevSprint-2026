/**
 * API Gateway
 * Centralizes authentication, rate limiting, and routing for all microservices
 */
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { createProxyMiddleware } = require('http-proxy-middleware')
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const path = require('path')
require('dotenv').config()

// ─── Observability ─────────────────────────────────────────────
const { logger } = require('./lib/logger')
const { incCounter, observeHistogram, toPrometheusFormat, toJSON, METRICS } = require('./lib/metrics')
const { correlationIdMiddleware } = require('./middleware/correlationId')
const { gracefulShutdown } = require('./lib/gracefulShutdown')

// ─── Environment ───────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  logger.fatal('JWT_SECRET is required')
  process.exit(1)
}

const SERVICES = {
  'identity-provider': process.env.IDENTITY_PROVIDER_URL || 'http://localhost:3001',
  'order-gateway': process.env.ORDER_GATEWAY_URL || 'http://localhost:3000',
  'stock-service': process.env.STOCK_SERVICE_URL || 'http://localhost:3002',
  'kitchen-queue': process.env.KITCHEN_QUEUE_URL || 'http://localhost:3003',
  'notification-hub': process.env.NOTIFICATION_HUB_URL || 'http://localhost:3004',
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const app = express()

// ─── Security Middleware ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow Swagger UI
  crossOriginEmbedderPolicy: false,
}))

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:80', 'http://localhost'],
  credentials: true,
}))

app.use(express.json())
app.use(correlationIdMiddleware)

// ─── Request Logging ───────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    incCounter(METRICS.HTTP_REQUESTS_TOTAL, { method: req.method, path: req.route?.path || req.path, status: res.statusCode })
    observeHistogram(METRICS.HTTP_REQUEST_DURATION_MS, duration, { method: req.method })
    logger.info({
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    }, 'Request completed')
  })
  next()
})

// ─── Redis Client (for rate limiting) ──────────────────────────
// Note: Redis is optional - falls back to in-memory rate limiting
let redisClient = null
let redisConnected = false

async function initRedis() {
  try {
    const Redis = require('ioredis')
    redisClient = new Redis(REDIS_URL, { 
      lazyConnect: true, 
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't retry
    })
    await redisClient.connect()
    redisConnected = true
    logger.info('Connected to Redis')
  } catch (err) { 
    logger.warn({ error: err.message }, 'Redis not available - using in-memory rate limiting')
    redisClient = null
    redisConnected = false
  }
}

// ─── Rate Limiting ─────────────────────────────────────────────
const createRateLimiter = (windowMs, max, message) => {
  const config = {
    windowMs,
    max,
    message: { message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.studentId || req.ip,
  }

  // Redis store is configured later after connection
  return rateLimit(config)
}

const globalLimiter = createRateLimiter(60000, 100, 'Too many requests. Please slow down.')
const authLimiter = createRateLimiter(60000, 5, 'Too many login attempts. Try again in 1 minute.')

app.use(globalLimiter)

// ─── JWT Authentication Middleware ─────────────────────────────
function extractToken(req) {
  const authHeader = req.headers['authorization']
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('token='))
    if (match) return match.split('=')[1].trim()
  }
  return null
}

function authMiddleware(req, res, next) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = {
      ...decoded,
      studentId: decoded.studentId || decoded.student_id || (decoded.email?.split('@')[0]),
    }
    // Pass user info to downstream services
    req.headers['x-user-id'] = req.user.studentId
    req.headers['x-user-email'] = req.user.email
    next()
  } catch (err) {
    logger.warn({ correlationId: req.correlationId, error: err.message }, 'Auth failed')
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

function optionalAuth(req, res, next) {
  const token = extractToken(req)
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      req.user = { ...decoded, studentId: decoded.studentId || decoded.student_id || decoded.email?.split('@')[0] }
      req.headers['x-user-id'] = req.user.studentId
    } catch { /* ignore */ }
  }
  next()
}

// ─── Public Routes (no auth) ───────────────────────────────────
// These paths don't require authentication
const _PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/health',
  '/api/health/all',
  '/metrics',
  '/metrics/prometheus',
  '/api-docs',
]

// ─── API Documentation ─────────────────────────────────────────
const docsPath = path.join(__dirname, '..', 'docs')
app.use('/api-docs', express.static(docsPath))
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(docsPath, 'swagger-ui.html'))
})

// ─── Health Check Aggregation ──────────────────────────────────
app.get('/api/health/all', async (req, res) => {
  const results = {}
  const checks = Object.entries(SERVICES).map(async ([name, url]) => {
    try {
      const response = await axios.get(`${url}/health`, {
        timeout: 3000,
        headers: { 'x-correlation-id': req.correlationId },
      })
      results[name] = { status: 'healthy', ...response.data }
    } catch (err) {
      results[name] = { status: 'unhealthy', error: err.message }
    }
  })

  await Promise.all(checks)

  const allHealthy = Object.values(results).every(r => r.status === 'healthy')
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    services: results,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  })
})

// ─── Metrics ───────────────────────────────────────────────────
app.get('/metrics', (req, res) => {
  const metricsData = toJSON()
  metricsData.uptime = process.uptime()
  res.json(metricsData)
})

app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(toPrometheusFormat())
})

// ─── Auth Routes (login/register) ──────────────────────────────
app.use('/api/auth', authLimiter, createProxyMiddleware({
  target: SERVICES['identity-provider'],
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
    },
  },
}))

// ─── Protected Routes ──────────────────────────────────────────
// Order Gateway
app.use('/api/orders', authMiddleware, createProxyMiddleware({
  target: SERVICES['order-gateway'],
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '/orders' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
      proxyReq.setHeader('x-user-id', req.user?.studentId || '')
    },
  },
}))

app.use('/api/menu', optionalAuth, createProxyMiddleware({
  target: SERVICES['order-gateway'],
  changeOrigin: true,
  pathRewrite: { '^/api/menu': '/menu' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
    },
  },
}))

app.use('/api/wallet', authMiddleware, createProxyMiddleware({
  target: SERVICES['order-gateway'],
  changeOrigin: true,
  pathRewrite: { '^/api/wallet': '/wallet' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
    },
  },
}))

app.use('/api/cafeteria', authMiddleware, createProxyMiddleware({
  target: SERVICES['order-gateway'],
  changeOrigin: true,
  pathRewrite: { '^/api/cafeteria': '/cafeteria' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
    },
  },
}))

app.use('/api/reviews', authMiddleware, createProxyMiddleware({
  target: SERVICES['order-gateway'],
  changeOrigin: true,
  pathRewrite: { '^/api/reviews': '/reviews' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
    },
  },
}))

// Admin routes (no additional auth - handled by downstream)
app.use('/api/admin', createProxyMiddleware({
  target: SERVICES['order-gateway'],
  changeOrigin: true,
  pathRewrite: { '^/api/admin': '/admin' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
    },
  },
}))

// Stock Service (internal)
app.use('/api/stock', createProxyMiddleware({
  target: SERVICES['stock-service'],
  changeOrigin: true,
  pathRewrite: { '^/api/stock': '/stock' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId)
    },
  },
}))

// ─── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' })
})

// ─── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error({ correlationId: req.correlationId, error: err.message, stack: err.stack }, 'Unhandled error')
  res.status(500).json({ message: 'Internal server error.' })
})

// ─── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 8080

async function start() {
  // Try to connect to Redis (optional)
  await initRedis()
  
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, redis: redisConnected }, 'API Gateway started')
  })

  // ─── Graceful Shutdown ─────────────────────────────────────────
  gracefulShutdown(server, {
    logger,
    onShutdown: async () => {
      if (redisClient && redisConnected) {
        await redisClient.quit().catch(() => {})
      }
    },
  })
}

start().catch(err => {
  logger.fatal({ error: err.message }, 'Failed to start API Gateway')
  process.exit(1)
})

module.exports = app
