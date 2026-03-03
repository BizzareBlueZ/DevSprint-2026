/**
 * Health & Metrics Routes
 * Provides health checks and Prometheus-compatible metrics
 */
const express = require('express')
const router = express.Router()
const { toJSON, toPrometheusFormat, getWindowedLatency } = require('../lib/metrics')

module.exports = function createHealthRoutes(pool, { redisClient, rabbitChannel }) {
  // GET /health
  router.get('/health', async (req, res) => {
    const deps = { database: 'connected', redis: 'connected', rabbitmq: 'connected' }

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

    if (!rabbitChannel) deps.rabbitmq = 'disconnected'

    const healthy = deps.database === 'connected'
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      service: 'order-gateway',
      dependencies: deps,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /metrics (JSON format for internal use)
  router.get('/metrics', (req, res) => {
    const metrics = toJSON()
    metrics.latency.averageLatencyMs30s = getWindowedLatency()
    metrics.uptime = process.uptime()
    res.json(metrics)
  })

  // GET /metrics/prometheus (Prometheus-compatible format)
  router.get('/metrics/prometheus', (req, res) => {
    res.set('Content-Type', 'text/plain')
    res.send(toPrometheusFormat())
  })

  // GET /time-slots
  router.get('/time-slots', (req, res) => {
    const now = new Date()
    const slots = []

    for (let hour = 11; hour <= 21; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const slotTime = new Date(now)
        slotTime.setHours(hour, min, 0, 0)

        if (slotTime.getTime() > now.getTime() + 30 * 60 * 1000) {
          slots.push({
            time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
            label: `${hour > 12 ? hour - 12 : hour}:${min.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`,
            datetime: slotTime.toISOString(),
          })
        }
      }
    }

    res.json({ slots })
  })

  return router
}
