const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const { Pool } = require('pg')
const app = express()

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'cafeteria',
    user:     process.env.DB_USER     || 'admin',
    password: process.env.DB_PASSWORD || 'secret123',
})

pool.connect((err, client, release) => {
    if (err) console.error('❌ DB connection failed:', err.message)
    else { console.log('✅ Connected to PostgreSQL'); release() }
})

// ─── Redis (optional) ──────────────────────────────────────────
let redisClient = null
try {
    const Redis = require('ioredis')
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true, enableOfflineQueue: false
    })
    redisClient.connect().then(() => console.log('✅ Connected to Redis'))
        .catch(() => { console.warn('⚠️  Redis not available'); redisClient = null })
} catch { console.warn('⚠️  Redis not available') }

// ─── Metrics ───────────────────────────────────────────────────
const metrics = { totalOrders: 0, failureCount: 0, totalLatency: 0, requestCount: 0 }

app.use(cors())
app.use(express.json())

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
        const result = await pool.query('SELECT quantity FROM stock WHERE item_id = $1', [itemId])
        if (result.rows.length === 0) return res.status(404).json({ message: 'Item not found.' })
        const quantity = result.rows[0].quantity

        // Cache the result
        if (redisClient) await redisClient.set(`stock:${itemId}`, quantity, 'EX', 60).catch(() => {})

        res.json({ itemId, quantity, source: 'database' })
    } catch (err) {
        console.error('Stock fetch error:', err)
        res.status(500).json({ message: 'Failed to fetch stock.' })
    }
})

// ─── POST /stock/:itemId/decrement — optimistic locking decrement
app.post('/stock/:itemId/decrement', async (req, res) => {
    const start = Date.now()
    const { itemId } = req.params
    const MAX_RETRIES = 3

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
                'SELECT quantity, version FROM stock WHERE item_id = $1',
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
                `UPDATE stock
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
            if (redisClient) await redisClient.set(`stock:${itemId}`, newQuantity, 'EX', 60).catch(() => {})

            metrics.totalOrders++
            metrics.requestCount++
            metrics.totalLatency += Date.now() - start

            return res.status(200).json({ message: 'Stock decremented.', newQuantity })

        } catch (err) {
            console.error(`Stock decrement error (attempt ${attempt + 1}):`, err)
            if (attempt === MAX_RETRIES - 1) {
                metrics.failureCount++
                return res.status(500).json({ message: 'Failed to decrement stock.' })
            }
        }
    }

    metrics.failureCount++
    return res.status(409).json({ message: 'Stock update conflict. Please try again.' })
})

// ─── GET /health ───────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1')
        res.status(200).json({ status: 'healthy', service: 'stock-service', timestamp: new Date().toISOString() })
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', reason: err.message })
    }
})

// ─── GET /metrics ──────────────────────────────────────────────
app.get('/metrics', (req, res) => {
    res.json({
        totalOrders:      metrics.totalOrders,
        failureCount:     metrics.failureCount,
        averageLatencyMs: metrics.requestCount > 0 ? Math.round(metrics.totalLatency / metrics.requestCount) : 0,
        uptime:           process.uptime(),
    })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`📦 Stock Service running on http://localhost:${PORT}`))

module.exports = { app, pool }