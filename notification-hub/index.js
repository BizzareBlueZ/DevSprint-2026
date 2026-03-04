const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const { Pool } = require('pg')
const webpush = require('web-push')
require('dotenv').config()

// ─── Observability ─────────────────────────────────────────────
const { logger } = require('./lib/logger')
const { incCounter, setGauge, toPrometheusFormat, toJSON, METRICS } = require('./lib/metrics')
const { correlationIdMiddleware } = require('./middleware/correlationId')

const app = express()
const server = http.createServer(app)

// ─── Database connection for push subscriptions ────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'iut_cafeteria',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

// ─── Web Push VAPID Configuration ──────────────────────────────
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  logger.fatal(
    'FATAL: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables are not set. Refusing to start.'
  )
  process.exit(1)
}
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

webpush.setVapidDetails('mailto:admin@iut-cafeteria.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:80', 'http://localhost'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:80', 'http://localhost'] }))
app.use(express.json())
app.use(correlationIdMiddleware)

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

// ─── Metrics ───────────────────────────────────────────────────
const metrics = { notificationsSent: 0, activeConnections: 0, pushSent: 0 }

// ─── Send Web Push Notification ────────────────────────────────
async function sendPushNotification(studentId, title, body, data = {}) {
  try {
    const result = await pool.query(
      'SELECT endpoint, p256dh, auth FROM identity.push_subscriptions WHERE student_id = $1',
      [studentId]
    )

    if (result.rows.length === 0) return 0

    const payload = JSON.stringify({ title, body, icon: '/iut-logo.png', data })

    let sent = 0
    for (const sub of result.rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        sent++
        metrics.pushSent++
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM identity.push_subscriptions WHERE endpoint = $1', [
            sub.endpoint,
          ])
        }
        logger.error({ studentId, error: err.message }, 'Push failed')
      }
    }
    return sent
  } catch (err) {
    logger.error({ studentId, error: err.message }, 'Push query failed')
    return 0
  }
}

// ─── Socket.IO — student connects and joins their order room ───
io.on('connection', socket => {
  metrics.activeConnections++
  setGauge(METRICS.ACTIVE_CONNECTIONS, metrics.activeConnections)
  logger.info({ socketId: socket.id, total: metrics.activeConnections }, 'Client connected')

  // Student joins a room named by their orderId (for order tracker page)
  socket.on('join-order', ({ orderId }) => {
    socket.join(orderId)
    logger.debug({ socketId: socket.id, orderId }, 'Socket joined order room')

    // Immediately confirm connection
    socket.emit('order-status', {
      orderId,
      status: 'PENDING',
      message: 'Connected to live updates',
    })
  })

  // Student joins a global room for all their orders (for toast notifications)
  socket.on('join-student', ({ studentId }) => {
    if (studentId) {
      socket.join(`student-${studentId}`)
      logger.debug({ socketId: socket.id, studentId }, 'Socket joined student room')
    }
  })

  socket.on('disconnect', () => {
    metrics.activeConnections--
    setGauge(METRICS.ACTIVE_CONNECTIONS, metrics.activeConnections)
    logger.info({ socketId: socket.id, total: metrics.activeConnections }, 'Client disconnected')
  })
})

// ─── POST /notify — called internally by Kitchen Queue ─────────
// Kitchen Queue → POST /notify → Socket.IO + Web Push → Student browser
app.post('/notify', async (req, res) => {
  const { orderId, status, orderInfo = {}, studentId } = req.body

  if (!orderId || !status) {
    return res.status(400).json({ message: 'orderId and status are required.' })
  }

  const payload = {
    orderId,
    status,
    orderInfo,
    timestamp: new Date().toISOString(),
  }

  // Push to all sockets in this order's room (order tracker page)
  io.to(orderId).emit('order-status', payload)

  // Also push to the student's global room (toast notifications on any page)
  if (studentId) {
    io.to(`student-${studentId}`).emit('order-status', payload)
  }

  // Send Web Push notification when order is READY
  if (studentId && (status === 'READY' || status === 'ready')) {
    const itemNames = orderInfo.items?.map(i => i.name).join(', ') || 'your order'
    const pushSent = await sendPushNotification(
      studentId,
      '🍽️ Order Ready!',
      `Your order is ready for pickup: ${itemNames}`,
      { url: '/order-tracker', orderId }
    )
    if (pushSent > 0) {
      incCounter(METRICS.PUSH_SENT, {}, pushSent)
      logger.info({ studentId, pushSent }, 'Sent push notification')
    }
  }

  metrics.notificationsSent++
  incCounter(METRICS.NOTIFICATIONS_SENT, { status })
  logger.info({ orderId, status }, 'Notified order')

  res.status(200).json({ message: 'Notification sent.', orderId, status })
})

// ─── POST /service-status — broadcast service health changes ───
// Called by admin dashboard when a service is killed/restored
app.post('/service-status', (req, res) => {
  const { serviceName, status, message } = req.body

  if (!serviceName || !status) {
    return res.status(400).json({ message: 'serviceName and status are required.' })
  }

  const payload = {
    serviceName,
    status, // 'killed' or 'restored'
    message: message || `${serviceName} has been ${status}.`,
    timestamp: new Date().toISOString(),
  }

  // Broadcast to ALL connected clients
  io.emit('service-status', payload)
  logger.info({ serviceName, status }, 'Service status broadcast')

  res.status(200).json({ message: 'Service status broadcast sent.', ...payload })
})

// ─── GET /health ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  const socketReady = io.engine && io.engine.clientsCount !== undefined
  const healthy = socketReady
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    service: 'notification-hub',
    dependencies: { socketio: socketReady ? 'ready' : 'not_ready' },
    activeConnections: metrics.activeConnections,
    timestamp: new Date().toISOString(),
  })
})

// ─── GET /metrics ──────────────────────────────────────────────
app.get('/metrics', (req, res) => {
  const metricsData = toJSON()
  metricsData.uptime = process.uptime()
  // Dashboard-compatible fields
  metricsData.totalOrders = metrics.notificationsSent
  metricsData.failureCount = 0
  metricsData.averageLatencyMs = 0
  res.json(metricsData)
})

// ─── GET /metrics/prometheus ───────────────────────────────────
app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(toPrometheusFormat())
})

// ─── Start ─────────────────────────────────────────────────
const { gracefulShutdown } = require('./lib/gracefulShutdown')

const PORT = process.env.PORT || 3004
server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Notification Hub started')
})

gracefulShutdown(server, {
  logger,
  onShutdown: async () => {
    await pool.end()
    io.close()
  },
})
