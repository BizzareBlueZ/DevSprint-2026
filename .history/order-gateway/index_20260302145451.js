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

// 30-second sliding window for latency monitoring (bonus challenge)
const LATENCY_WINDOW_MS = 30000
const latencyWindow = [] // Array of { timestamp, latencyMs }

function recordLatency(latencyMs) {
    const now = Date.now()
    latencyWindow.push({ timestamp: now, latencyMs })
    // Prune entries older than 30 seconds
    while (latencyWindow.length > 0 && now - latencyWindow[0].timestamp > LATENCY_WINDOW_MS) {
        latencyWindow.shift()
    }
}

function getWindowedLatency() {
    const now = Date.now()
    const recent = latencyWindow.filter(e => now - e.timestamp <= LATENCY_WINDOW_MS)
    if (recent.length === 0) return 0
    return Math.round(recent.reduce((sum, e) => sum + e.latencyMs, 0) / recent.length)
}

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

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

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

// GET /menu
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

// GET /orders/:orderId
app.get('/orders/:orderId', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.order_id, o.status, o.amount, o.created_at, o.updated_at,
                    m.name as item_name, m.price
             FROM orders.orders o
                      JOIN public.menu_items m ON m.id = o.item_id
             WHERE o.order_id = $1 AND o.student_id = $2`,
            [req.params.orderId, req.user.studentId]
        )
        if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found.' })
        res.json(result.rows[0])
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch order.' })
    }
})

// POST /orders
// Supports X-Idempotency-Key header to handle partial failures safely.
// If a request crashes after processing but before the client receives a response,
// the client can safely retry with the same idempotency key and receive the original result.
app.post('/orders', requireAuth, async (req, res) => {
    const start = Date.now()
    const { itemId, type = 'dinner' } = req.body
    const { studentId } = req.user
    const idempotencyKey = req.headers['x-idempotency-key'] || null

    if (!itemId) return res.status(400).json({ message: 'itemId is required.' })

    // ── Idempotency check: if key provided, check for existing order ──
    if (idempotencyKey) {
        try {
            const existing = await pool.query(
                `SELECT o.order_id, o.status, o.amount, m.name as item_name
                 FROM orders o JOIN menu_items m ON m.id = o.item_id
                 WHERE o.idempotency_key = $1 AND o.student_id = $2`,
                [idempotencyKey, studentId]
            )
            if (existing.rows.length > 0) {
                const prev = existing.rows[0]
                return res.status(202).json({
                    orderId: prev.order_id,
                    message: 'Order already processed (idempotent retry).',
                    item: prev.item_name,
                    idempotent: true,
                })
            }
        } catch (err) {
            console.error('Idempotency lookup error:', err)
        }
    }

    const orderId = uuidv4()

    try {
        if (redisClient) {
            const cached = await redisClient.get(`stock:${itemId}`).catch(() => null)
            if (cached === '0') {
                metrics.failureCount++
                return res.status(409).json({ message: 'Out of stock.' })
            }
        }

        const itemResult = await pool.query(
            'SELECT id, name, price FROM menu_items WHERE id = $1 AND is_available = true',
            [itemId]
        )
        if (itemResult.rows.length === 0) return res.status(404).json({ message: 'Item not found.' })
        const item = itemResult.rows[0]

        const balanceResult = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
             FROM transactions WHERE student_id = $1`,
            [studentId]
        )
        const balance = parseFloat(balanceResult.rows[0].balance)
        if (balance < item.price) {
            return res.status(402).json({
                message: `Insufficient balance. You have ৳${balance.toFixed(2)} but need ৳${item.price}.`
            })
        }

        await pool.query(
            `INSERT INTO orders.orders (order_id, idempotency_key, student_id, item_id, type, status, amount)
             VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)`,
            [orderId, idempotencyKey, studentId, itemId, type, item.price]
        )

        const newBalance = balance - item.price
        await pool.query(
            `INSERT INTO transactions (student_id, type, amount, balance_after, description, order_id)
             VALUES ($1, 'debit', $2, $3, $4, $5)`,
            [studentId, item.price, newBalance, `Meal order: ${item.name}`, orderId]
        )

        try {
            await axios.post(`${STOCK_SERVICE_URL}/stock/${itemId}/decrement`, {
                orderId,
            }, { timeout: 3000 })
        } catch (err) {
            await pool.query("UPDATE orders SET status = 'FAILED' WHERE order_id = $1", [orderId])
            await pool.query(
                `INSERT INTO transactions (student_id, type, amount, balance_after, description, order_id)
                 VALUES ($1, 'credit', $2, $3, 'Refund: stock unavailable', $4)`,
                [studentId, item.price, balance, orderId]
            )
            metrics.failureCount++
            return res.status(409).json({ message: err.response?.data?.message || 'Out of stock.' })
        }

        await pool.query(
            "UPDATE orders.orders SET status = 'STOCK_VERIFIED', acknowledged_at = NOW() WHERE order_id = $1",
            [orderId]
        )

        const orderMsg = { orderId, studentId, itemId, itemName: item.name, type, timestamp: new Date().toISOString() }
        if (rabbitChannel) {
            rabbitChannel.sendToQueue('orders', Buffer.from(JSON.stringify(orderMsg)), { persistent: true })
        } else {
            simulateKitchen(orderMsg)
        }

        metrics.totalOrders++
        metrics.requestCount++
        const latency = Date.now() - start
        metrics.totalLatency += latency
        recordLatency(latency)

        return res.status(202).json({ orderId, message: 'Order received! Track your status below.', item: item.name })

    } catch (err) {
        // Handle unique constraint violation on idempotency_key (concurrent duplicate request)
        if (err.code === '23505' && err.constraint && idempotencyKey) {
            const existing = await pool.query(
                `SELECT o.order_id, o.status, m.name as item_name
                 FROM orders.orders o JOIN public.menu_items m ON m.id = o.item_id
                 WHERE o.idempotency_key = $1`,
                [idempotencyKey]
            ).catch(() => ({ rows: [] }))
            if (existing.rows.length > 0) {
                const prev = existing.rows[0]
                return res.status(202).json({
                    orderId: prev.order_id,
                    message: 'Order already processed (idempotent retry).',
                    item: prev.item_name,
                    idempotent: true,
                })
            }
        }
        console.error('Order error:', err)
        metrics.failureCount++
        return res.status(500).json({ message: 'Internal server error.' })
    }
})

// POST /cafeteria/tokens/bulk
app.post('/cafeteria/tokens/bulk', requireAuth, async (req, res) => {
    const { tokens } = req.body
    const { studentId } = req.user
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ message: 'tokens array is required.' })
    }

    const TOKEN_PRICE = { dinner: 120.00, iftar: 100.00 }
    const totalCost = tokens.reduce((sum, t) => sum + (TOKEN_PRICE[t.type] || 120), 0)
    const orderId = uuidv4()

    try {
        const balanceResult = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
             FROM transactions WHERE student_id = $1`,
            [studentId]
        )
        const balance = parseFloat(balanceResult.rows[0].balance)
        if (balance < totalCost) {
            return res.status(402).json({
                message: `Insufficient balance. You have ৳${balance.toFixed(2)} but need ৳${totalCost.toFixed(2)} for ${tokens.length} token(s).`
            })
        }

        const insertedTokens = []
        for (const t of tokens) {
            const result = await pool.query(
                `INSERT INTO tokens (student_id, type, meal_date, order_id)
                 VALUES ($1, $2, $3, $4) ON CONFLICT (student_id, type, meal_date) DO NOTHING`,
                [studentId, t.type, t.date, orderId]
            )
            if (result.rowCount > 0) insertedTokens.push(t)
        }
        const inserted = insertedTokens.length

        if (inserted === 0) return res.status(409).json({ message: 'All selected tokens already exist.' })

        const actualCost = insertedTokens.reduce((sum, t) => sum + (TOKEN_PRICE[t.type] || 120), 0)
        const newBalance = balance - actualCost

        await pool.query(
            `INSERT INTO public.transactions (student_id, type, amount, balance_after, description, order_id)
             VALUES ($1, 'debit', $2, $3, $4, $5)`,
            [studentId, actualCost, newBalance, `Token booking: ${inserted} meal token(s)`, orderId]
        )

        res.status(202).json({ orderId, inserted, totalCost: actualCost, newBalance,
            message: `${inserted} token(s) booked. ৳${actualCost.toFixed(2)} deducted from wallet.` })

    } catch (err) {
        console.error('Token booking error:', err)
        res.status(500).json({ message: 'Failed to book tokens.' })
    }
})

// GET /cafeteria/tokens
app.get('/cafeteria/tokens', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT type, meal_date as date, is_used FROM orders.tokens
             WHERE student_id = $1 AND meal_date >= CURRENT_DATE AND is_used = false
             ORDER BY meal_date ASC`,
            [req.user.studentId]
        )
        res.json({ tokens: result.rows })
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tokens.' })
    }
})

// GET /cafeteria/purchases
app.get('/cafeteria/purchases', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT meal_date as date, type, status FROM orders.orders
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
             FROM public.transactions WHERE student_id = $1`,
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
             FROM public.transactions WHERE student_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [req.user.studentId]
        )
        res.json({ transactions: result.rows })
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch transactions.' })
    }
})

// POST /wallet/topup ── NEW ─────────────────────────────────────
app.post('/wallet/topup', requireAuth, async (req, res) => {
    const { amount, method = 'bkash', reference } = req.body
    const { studentId } = req.user

    if (!amount || isNaN(amount) || parseFloat(amount) < 10) {
        return res.status(400).json({ message: 'Minimum top-up amount is ৳10.' })
    }

    const amt = parseFloat(parseFloat(amount).toFixed(2))

    try {
        const balResult = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
             FROM transactions WHERE student_id = $1`,
            [studentId]
        )
        const currentBalance = parseFloat(balResult.rows[0].balance)
        const newBalance = parseFloat((currentBalance + amt).toFixed(2))

        const methodLabels = {
            bkash:  'bKash Top-up',
            nagad:  'Nagad Top-up',
            rocket: 'Rocket Top-up',
            bank:   'Bank Transfer',
        }
        const description = `${methodLabels[method] || 'Wallet Top-up'}${reference ? ` · ${reference}` : ''}`

        await pool.query(
            `INSERT INTO transactions (student_id, type, amount, balance_after, description)
             VALUES ($1, 'credit', $2, $3, $4)`,
            [studentId, amt, newBalance, description]
        )

        return res.status(200).json({ message: 'Wallet topped up successfully.', amount: amt, newBalance, method })
    } catch (err) {
        console.error('Top-up error:', err)
        return res.status(500).json({ message: 'Top-up failed. Please try again.' })
    }
})

// ─── Health & Metrics ──────────────────────────────────────────
app.get('/health', async (req, res) => {
    const deps = { database: 'connected', redis: 'connected', rabbitmq: 'connected' }
    try { await pool.query('SELECT 1') } catch { deps.database = 'disconnected' }
    if (redisClient) {
        try { await redisClient.ping() } catch { deps.redis = 'disconnected' }
    } else { deps.redis = 'not_configured' }
    if (!rabbitChannel) deps.rabbitmq = 'disconnected'
    const healthy = deps.database === 'connected'
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'unhealthy',
        service: 'order-gateway',
        dependencies: deps,
        timestamp: new Date().toISOString(),
    })
})

app.get('/metrics', (req, res) => {
    const windowedLatency = getWindowedLatency()
    res.json({
        totalOrders:           metrics.totalOrders,
        failureCount:          metrics.failureCount,
        averageLatencyMs:      metrics.requestCount > 0 ? Math.round(metrics.totalLatency / metrics.requestCount) : 0,
        averageLatencyMs30s:   windowedLatency,
        latencyAlert:          windowedLatency > 1000,
        windowSampleCount:     latencyWindow.length,
        uptime:                process.uptime(),
    })
})

// ─── Simulate Kitchen (when RabbitMQ is not running) ──────────
async function simulateKitchen(order) {
    const notify = async (status) => {
        try {
            await pool.query("UPDATE orders.orders SET status = $1, updated_at = NOW() WHERE order_id = $2", [status, order.orderId])
            await axios.post(`${NOTIFICATION_HUB_URL}/notify`, { orderId: order.orderId, status, orderInfo: { itemName: order.itemName }, studentId: order.studentId }).catch(() => {})
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