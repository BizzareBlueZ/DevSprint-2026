const express = require('express')
const jwt     = require('jsonwebtoken')
const cors    = require('cors')
const { v4: uuidv4 } = require('uuid')
const axios   = require('axios')
require('dotenv').config()

const pool = require('./db')
const app  = express()

const JWT_SECRET           = process.env.JWT_SECRET           || 'iut-cafeteria-super-secret-2026'
const STOCK_SERVICE_URL    = process.env.STOCK_SERVICE_URL    || 'http://localhost:3002'
const NOTIFICATION_HUB_URL = process.env.NOTIFICATION_HUB_URL || 'http://localhost:3004'
const RABBITMQ_URL         = process.env.RABBITMQ_URL         || 'amqp://guest:guest@localhost:5672'
const REDIS_URL            = process.env.REDIS_URL            || 'redis://localhost:6379'

// ─── Metrics ───────────────────────────────────────────────────
const metrics = { totalOrders: 0, failureCount: 0, totalLatency: 0, requestCount: 0 }

// ─── Redis (optional - graceful degradation if not running) ────
let redisClient = null
try {
    const Redis = require('ioredis')
    redisClient = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false })
    redisClient.connect().then(() => console.log('✅ Connected to Redis'))
        .catch(() => { console.warn('⚠️  Redis not available - cache disabled'); redisClient = null })
} catch { console.warn('⚠️  Redis not available - cache disabled') }

// ─── RabbitMQ (optional - graceful degradation if not running) ─
let rabbitChannel = null
async function connectRabbitMQ() {
    try {
        const amqp = require('amqplib')
        const conn = await amqp.connect(RABBITMQ_URL)
        rabbitChannel = await conn.createChannel()
        await rabbitChannel.assertQueue('orders', { durable: true })
        console.log('✅ Connected to RabbitMQ')
    } catch {
        console.warn('⚠️  RabbitMQ not available - orders will be processed directly')
    }
}
connectRabbitMQ()

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost'], credentials: true }))
app.use(express.json())

// ─── JWT Auth Middleware ───────────────────────────────────────
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) return res.status(401).json({ message: 'No token provided.' })
    try {
        req.user = jwt.verify(token, JWT_SECRET)
        next()
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' })
    }
}

// ─── Routes ───────────────────────────────────────────────────

// GET /menu — list all available menu items with stock
app.get('/menu', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT m.id, m.name, m.description, m.price, m.category, m.is_available,
             COALESCE(s.quantity, 0) as stock
      FROM menu_items m
      LEFT JOIN stock s ON s.item_id = m.id
      WHERE m.is_available = true
      ORDER BY m.category, m.name
    `)
        res.json({ items: result.rows })
    } catch (err) {
        console.error('Menu error:', err)
        res.status(500).json({ message: 'Failed to fetch menu.' })
    }
})

// POST /orders — place a new order
app.post('/orders', requireAuth, async (req, res) => {
    const start = Date.now()
    const { itemId, type = 'dinner' } = req.body
    const { studentId } = req.user

    if (!itemId) return res.status(400).json({ message: 'itemId is required.' })

    const orderId = uuidv4()

    try {
        // ── 1. Check Redis cache first ──────────────────────────────
        if (redisClient) {
            const cached = await redisClient.get(`stock:${itemId}`).catch(() => null)
            if (cached === '0') {
                metrics.failureCount++
                return res.status(409).json({ message: 'Out of stock.' })
            }
        }

        // ── 2. Get item details ─────────────────────────────────────
        const itemResult = await pool.query(
            'SELECT id, name, price FROM menu_items WHERE id = $1 AND is_available = true',
            [itemId]
        )
        if (itemResult.rows.length === 0) {
            return res.status(404).json({ message: 'Item not found.' })
        }
        const item = itemResult.rows[0]

        // ── 3. Create order record (PENDING) ────────────────────────
        await pool.query(
            `INSERT INTO orders (order_id, student_id, item_id, type, status, amount)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
            [orderId, studentId, itemId, type, item.price]
        )

        // ── 4. Deduct stock via Stock Service ───────────────────────
        try {
            await axios.post(`${STOCK_SERVICE_URL}/stock/${itemId}/decrement`, {}, { timeout: 3000 })
        } catch (err) {
            // Stock service down or out of stock
            await pool.query("UPDATE orders SET status = 'FAILED' WHERE order_id = $1", [orderId])
            const msg = err.response?.data?.message || 'Out of stock or stock service unavailable.'
            metrics.failureCount++
            return res.status(409).json({ message: msg })
        }

        // ── 5. Update order to STOCK_VERIFIED ───────────────────────
        await pool.query(
            "UPDATE orders SET status = 'STOCK_VERIFIED', acknowledged_at = NOW() WHERE order_id = $1",
            [orderId]
        )

        // ── 6. Push to Kitchen Queue (RabbitMQ or direct) ───────────
        const orderMsg = { orderId, studentId, itemId, itemName: item.name, type, timestamp: new Date().toISOString() }

        if (rabbitChannel) {
            rabbitChannel.sendToQueue('orders', Buffer.from(JSON.stringify(orderMsg)), { persistent: true })
        } else {
            // No RabbitMQ — simulate kitchen directly
            simulateKitchen(orderMsg)
        }

        // ── 7. Respond immediately (<2s) ────────────────────────────
        metrics.totalOrders++
        metrics.requestCount++
        metrics.totalLatency += Date.now() - start

        return res.status(202).json({
            orderId,
            message: 'Order received! Track your status below.',
            item: item.name,
        })

    } catch (err) {
        console.error('Order error:', err)
        metrics.failureCount++
        return res.status(500).json({ message: 'Internal server error.' })
    }
})

// POST /cafeteria/tokens/bulk — Ramadan advance token booking
app.post('/cafeteria/tokens/bulk', requireAuth, async (req, res) => {
    const { tokens } = req.body
    const { studentId } = req.user
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ message: 'tokens array is required.' })
    }
    const orderId = uuidv4()
    try {
        for (const t of tokens) {
            await pool.query(
                `INSERT INTO tokens (student_id, type, meal_date, order_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [studentId, t.type, t.date, orderId]
            )
        }
        res.status(202).json({ orderId, message: `${tokens.length} token(s) booked successfully.` })
    } catch (err) {
        console.error('Token booking error:', err)
        res.status(500).json({ message: 'Failed to book tokens.' })
    }
})

// GET /cafeteria/tokens — get student's available tokens
app.get('/cafeteria/tokens', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT type, meal_date as date, is_used FROM tokens
       WHERE student_id = $1 AND meal_date >= CURRENT_DATE AND is_used = false
       ORDER BY meal_date ASC`,
            [req.user.studentId]
        )
        res.json({ tokens: result.rows })
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tokens.' })
    }
})

// GET /cafeteria/purchases — get purchased meals calendar
app.get('/cafeteria/purchases', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT meal_date as date, type, status FROM orders
       WHERE student_id = $1 AND status != 'FAILED'
       ORDER BY meal_date DESC LIMIT 60`,
            [req.user.studentId]
        )
        res.json({ purchases: result.rows })
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch purchases.' })
    }
})

// GET /wallet/balance
app.get('/wallet/balance', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) as balance
       FROM transactions WHERE student_id = $1`,
            [req.user.studentId]
        )
        res.json({ balance: parseFloat(result.rows[0].balance) })
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch balance.' })
    }
})

// GET /wallet/transactions
app.get('/wallet/transactions', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT type, amount, balance_after, description, created_at
       FROM transactions WHERE student_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [req.user.studentId]
        )
        res.json({ transactions: result.rows })
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch transactions.' })
    }
})

// ─── Health & Metrics ──────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1')
        res.status(200).json({ status: 'healthy', service: 'order-gateway', timestamp: new Date().toISOString() })
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', reason: err.message })
    }
})

app.get('/metrics', (req, res) => {
    res.json({
        totalOrders:      metrics.totalOrders,
        failureCount:     metrics.failureCount,
        averageLatencyMs: metrics.requestCount > 0 ? Math.round(metrics.totalLatency / metrics.requestCount) : 0,
        uptime:           process.uptime(),
    })
})

// ─── Simulate Kitchen (when RabbitMQ is not running) ──────────
async function simulateKitchen(order) {
    const notify = async (status) => {
        try {
            await pool.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2", [status, order.orderId])
            await axios.post(`${NOTIFICATION_HUB_URL}/notify`, { orderId: order.orderId, status, orderInfo: { itemName: order.itemName } }).catch(() => {})
        } catch {}
    }
    setTimeout(() => notify('IN_KITCHEN'), 1000)
    setTimeout(() => notify('READY'),      5000 + Math.random() * 2000)
}

// ─── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`🚪 Order Gateway running on http://localhost:${PORT}`)
})