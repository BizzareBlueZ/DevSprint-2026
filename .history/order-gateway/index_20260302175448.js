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
    let token = authHeader && authHeader.split(' ')[1]

    // Fallback: read token from httpOnly cookie
    if (!token && req.headers.cookie) {
        const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('token='))
        if (match) token = match.split('=')[1].trim()
    }

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
            FROM public.menu_items m
                     LEFT JOIN inventory.stock s ON s.item_id = m.id
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
    const { itemId, type = 'dinner', scheduledPickupTime } = req.body
    const { studentId } = req.user
    const idempotencyKey = req.headers['x-idempotency-key'] || null

    if (!itemId) return res.status(400).json({ message: 'itemId is required.' })

    // ── Idempotency check: if key provided, check for existing order ──
    if (idempotencyKey) {
        try {
            const existing = await pool.query(
                `SELECT o.order_id, o.status, o.amount, m.name as item_name
                 FROM orders.orders o JOIN public.menu_items m ON m.id = o.item_id
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
            'SELECT id, name, price FROM public.menu_items WHERE id = $1 AND is_available = true',
            [itemId]
        )
        if (itemResult.rows.length === 0) return res.status(404).json({ message: 'Item not found.' })
        const item = itemResult.rows[0]

        const balanceResult = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
             FROM public.transactions WHERE student_id = $1`,
            [studentId]
        )
        const balance = parseFloat(balanceResult.rows[0].balance)
        if (balance < item.price) {
            return res.status(402).json({
                message: `Insufficient balance. You have ৳${balance.toFixed(2)} but need ৳${item.price}.`
            })
        }

        await pool.query(
            `INSERT INTO orders.orders (order_id, idempotency_key, student_id, item_id, type, status, amount, scheduled_pickup_time)
             VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
            [orderId, idempotencyKey, studentId, itemId, type, item.price, scheduledPickupTime || null]
        )

        const newBalance = balance - item.price
        await pool.query(
            `INSERT INTO public.transactions (student_id, type, amount, balance_after, description, order_id)
             VALUES ($1, 'debit', $2, $3, $4, $5)`,
            [studentId, item.price, newBalance, `Meal order: ${item.name}`, orderId]
        )

        try {
            await axios.post(`${STOCK_SERVICE_URL}/stock/${itemId}/decrement`, {
                orderId,
            }, { timeout: 3000 })
        } catch (err) {
            await pool.query("UPDATE orders.orders SET status = 'FAILED' WHERE order_id = $1", [orderId])
            await pool.query(
                `INSERT INTO public.transactions (student_id, type, amount, balance_after, description, order_id)
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
             FROM public.transactions WHERE student_id = $1`,
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
                `INSERT INTO orders.tokens (student_id, type, meal_date, order_id)
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

// GET /wallet/balance (reads from materialized cache — O(1) lookup)
app.get('/wallet/balance', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COALESCE(balance, 0) as balance
             FROM public.wallet_balances_materialized WHERE student_id = $1`,
            [req.user.studentId]
        )
        const balance = result.rows.length > 0 ? parseFloat(result.rows[0].balance) : 0
        res.json({ balance })
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
            `SELECT COALESCE(balance, 0) AS balance
             FROM public.wallet_balances_materialized WHERE student_id = $1`,
            [studentId]
        )
        const currentBalance = balResult.rows.length > 0 ? parseFloat(balResult.rows[0].balance) : 0
        const newBalance = parseFloat((currentBalance + amt).toFixed(2))

        const methodLabels = {
            bkash:  'bKash Top-up',
            nagad:  'Nagad Top-up',
            rocket: 'Rocket Top-up',
            bank:   'Bank Transfer',
        }
        const description = `${methodLabels[method] || 'Wallet Top-up'}${reference ? ` · ${reference}` : ''}`

        await pool.query(
            `INSERT INTO public.transactions (student_id, type, amount, balance_after, description)
             VALUES ($1, 'credit', $2, $3, $4)`,
            [studentId, amt, newBalance, description]
        )

        // Update the materialized balance cache
        await pool.query(
            `INSERT INTO public.wallet_balances_materialized (student_id, balance, last_updated)
             VALUES ($1, $2, NOW())
             ON CONFLICT (student_id) DO UPDATE SET balance = $2, last_updated = NOW()`,
            [studentId, newBalance]
        )

        return res.status(200).json({ message: 'Wallet topped up successfully.', amount: amt, newBalance, method })
    } catch (err) {
        console.error('Top-up error:', err)
        return res.status(500).json({ message: 'Top-up failed. Please try again.' })
    }
})

// ─── Emergency Balance (Advance from IUT Monthly Allowance) ───
const EMERGENCY_LIMIT = 1000

// GET /wallet/emergency/status — check outstanding emergency loans
app.get('/wallet/emergency/status', requireAuth, async (req, res) => {
    const { studentId } = req.user
    try {
        const result = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS outstanding
             FROM public.emergency_loans
             WHERE student_id = $1 AND status = 'active'`,
            [studentId]
        )
        const outstanding = parseFloat(result.rows[0].outstanding)
        const available = Math.max(0, EMERGENCY_LIMIT - outstanding)
        res.json({ outstanding, available, limit: EMERGENCY_LIMIT })
    } catch (err) {
        console.error('Emergency status error:', err)
        res.status(500).json({ message: 'Failed to check emergency balance.' })
    }
})

// POST /wallet/emergency/request — take emergency balance
app.post('/wallet/emergency/request', requireAuth, async (req, res) => {
    const { studentId } = req.user
    const { amount, reason } = req.body

    if (!amount || isNaN(amount) || parseFloat(amount) < 10) {
        return res.status(400).json({ message: 'Minimum emergency balance is ৳10.' })
    }

    const amt = parseFloat(parseFloat(amount).toFixed(2))

    try {
        // Check current outstanding
        const outResult = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS outstanding
             FROM public.emergency_loans
             WHERE student_id = $1 AND status = 'active'`,
            [studentId]
        )
        const outstanding = parseFloat(outResult.rows[0].outstanding)
        const available = EMERGENCY_LIMIT - outstanding

        if (amt > available) {
            return res.status(400).json({
                message: `You can only take up to ৳${available.toFixed(2)} more. Outstanding: ৳${outstanding.toFixed(2)}.`,
                outstanding,
                available,
                limit: EMERGENCY_LIMIT,
            })
        }

        // Get current balance
        const balResult = await pool.query(
            `SELECT COALESCE(balance, 0) AS balance
             FROM public.wallet_balances_materialized WHERE student_id = $1`,
            [studentId]
        )
        const currentBalance = balResult.rows.length > 0 ? parseFloat(balResult.rows[0].balance) : 0
        const newBalance = parseFloat((currentBalance + amt).toFixed(2))

        // Create loan record
        await pool.query(
            `INSERT INTO public.emergency_loans (student_id, amount, reason)
             VALUES ($1, $2, $3)`,
            [studentId, amt, reason || 'Emergency balance request']
        )

        // Credit wallet
        await pool.query(
            `INSERT INTO public.transactions (student_id, type, amount, balance_after, description)
             VALUES ($1, 'credit', $2, $3, $4)`,
            [studentId, amt, newBalance, `Emergency Advance · Will be deducted from monthly allowance`]
        )

        // Update materialized balance
        await pool.query(
            `INSERT INTO public.wallet_balances_materialized (student_id, balance, last_updated)
             VALUES ($1, $2, NOW())
             ON CONFLICT (student_id) DO UPDATE SET balance = $2, last_updated = NOW()`,
            [studentId, newBalance]
        )

        const newOutstanding = outstanding + amt
        const newAvailable = EMERGENCY_LIMIT - newOutstanding

        return res.status(200).json({
            message: 'Emergency balance added successfully.',
            amount: amt,
            newBalance,
            outstanding: newOutstanding,
            available: newAvailable,
            limit: EMERGENCY_LIMIT,
        })
    } catch (err) {
        console.error('Emergency request error:', err)
        return res.status(500).json({ message: 'Failed to process emergency balance.' })
    }
})

// ══════════════════════════════════════════════════════════════
// ADMIN APIs
// ══════════════════════════════════════════════════════════════

// ─── GET /admin/menu — list all menu items for admin ──────────
app.get('/admin/menu', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.id, m.name, m.description, m.price, m.category, m.is_available, m.image_url, m.created_at,
                   COALESCE(s.quantity, 0) as stock
            FROM public.menu_items m
            LEFT JOIN inventory.stock s ON s.item_id = m.id
            ORDER BY m.category, m.name
        `)
        res.json({ items: result.rows })
    } catch (err) {
        console.error('Admin menu fetch error:', err)
        res.status(500).json({ message: 'Failed to fetch menu items.' })
    }
})

// ─── POST /admin/menu — create a new menu item ────────────────
app.post('/admin/menu', async (req, res) => {
    const { name, description, price, category, is_available = true, image_url, initial_stock = 50 } = req.body
    if (!name || !price || !category) {
        return res.status(400).json({ message: 'name, price and category are required.' })
    }
    try {
        const result = await pool.query(
            `INSERT INTO public.menu_items (name, description, price, category, is_available, image_url)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, description, parseFloat(price), category, is_available, image_url]
        )
        const item = result.rows[0]
        // Create stock entry
        await pool.query(
            `INSERT INTO inventory.stock (item_id, quantity, version) VALUES ($1, $2, 1)
             ON CONFLICT (item_id) DO NOTHING`,
            [item.id, initial_stock]
        )
        res.status(201).json({ message: 'Menu item created.', item })
    } catch (err) {
        console.error('Create menu item error:', err)
        res.status(500).json({ message: 'Failed to create menu item.' })
    }
})

// ─── PUT /admin/menu/:id — update a menu item ─────────────────
app.put('/admin/menu/:id', async (req, res) => {
    const { id } = req.params
    const { name, description, price, category, is_available, image_url } = req.body
    try {
        const result = await pool.query(
            `UPDATE public.menu_items 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 price = COALESCE($3, price),
                 category = COALESCE($4, category),
                 is_available = COALESCE($5, is_available),
                 image_url = COALESCE($6, image_url)
             WHERE id = $7 RETURNING *`,
            [name, description, price ? parseFloat(price) : null, category, is_available, image_url, id]
        )
        if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found.' })
        res.json({ message: 'Menu item updated.', item: result.rows[0] })
    } catch (err) {
        console.error('Update menu item error:', err)
        res.status(500).json({ message: 'Failed to update menu item.' })
    }
})

// ─── DELETE /admin/menu/:id — delete a menu item ──────────────
app.delete('/admin/menu/:id', async (req, res) => {
    const { id } = req.params
    try {
        const result = await pool.query('DELETE FROM public.menu_items WHERE id = $1 RETURNING *', [id])
        if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found.' })
        // Also delete stock entry
        await pool.query('DELETE FROM inventory.stock WHERE item_id = $1', [id])
        res.json({ message: 'Menu item deleted.' })
    } catch (err) {
        console.error('Delete menu item error:', err)
        res.status(500).json({ message: 'Failed to delete menu item.' })
    }
})

// ─── PUT /admin/stock/:itemId — update stock quantity ─────────
app.put('/admin/stock/:itemId', async (req, res) => {
    const { itemId } = req.params
    const { quantity } = req.body
    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ message: 'Valid quantity is required.' })
    }
    try {
        const result = await pool.query(
            `INSERT INTO inventory.stock (item_id, quantity, version) VALUES ($1, $2, 1)
             ON CONFLICT (item_id) DO UPDATE SET quantity = $2, updated_at = NOW()
             RETURNING *`,
            [itemId, parseInt(quantity)]
        )
        // Invalidate Redis cache
        if (redisClient) await redisClient.del(`stock:${itemId}`).catch(() => {})
        res.json({ message: 'Stock updated.', stock: result.rows[0] })
    } catch (err) {
        console.error('Update stock error:', err)
        res.status(500).json({ message: 'Failed to update stock.' })
    }
})

// ─── GET /admin/analytics — get analytics data ────────────────
app.get('/admin/analytics', async (req, res) => {
    try {
        // Popular items (top 10 by order count)
        const popularItems = await pool.query(`
            SELECT m.id, m.name, m.category, COUNT(o.order_id) as order_count, 
                   SUM(o.amount) as total_revenue
            FROM orders.orders o
            JOIN public.menu_items m ON m.id = o.item_id
            WHERE o.status NOT IN ('FAILED', 'CANCELLED')
            GROUP BY m.id, m.name, m.category
            ORDER BY order_count DESC
            LIMIT 10
        `)

        // Peak order times (orders per hour)
        const peakTimes = await pool.query(`
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as order_count
            FROM orders.orders
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY hour
            ORDER BY hour
        `)

        // Daily revenue (last 30 days)
        const dailyRevenue = await pool.query(`
            SELECT DATE(created_at) as date, SUM(amount) as revenue, COUNT(*) as order_count
            FROM orders.orders
            WHERE status NOT IN ('FAILED', 'CANCELLED') AND created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `)

        // Total stats
        const totalStats = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(amount) as total_revenue,
                COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_orders
            FROM orders.orders
        `)

        res.json({
            popularItems: popularItems.rows,
            peakTimes: peakTimes.rows,
            dailyRevenue: dailyRevenue.rows,
            totals: totalStats.rows[0]
        })
    } catch (err) {
        console.error('Analytics error:', err)
        res.status(500).json({ message: 'Failed to fetch analytics.' })
    }
})

// ─── ORDER HISTORY ─────────────────────────────────────────────
/**
 * GET /orders
 * Get order history for authenticated student with filtering/search
 */
app.get('/orders', requireAuth, async (req, res) => {
    const { status, search, from, to, limit = 50, offset = 0 } = req.query
    const { studentId } = req.user
    
    let query = `
        SELECT o.order_id, o.status, o.amount, o.type, o.meal_date, 
               o.scheduled_pickup_time, o.qr_code, o.pickup_verified,
               o.created_at, o.completed_at,
               m.id as item_id, m.name as item_name, m.category, m.image_url,
               r.rating, r.comment as review_comment
        FROM orders.orders o
        JOIN public.menu_items m ON m.id = o.item_id
        LEFT JOIN public.reviews r ON r.order_id = o.order_id
        WHERE o.student_id = $1
    `
    const params = [studentId]
    let paramCount = 1
    
    if (status) {
        paramCount++
        query += ` AND o.status = $${paramCount}`
        params.push(status)
    }
    if (search) {
        paramCount++
        query += ` AND m.name ILIKE $${paramCount}`
        params.push(`%${search}%`)
    }
    if (from) {
        paramCount++
        query += ` AND o.created_at >= $${paramCount}`
        params.push(from)
    }
    if (to) {
        paramCount++
        query += ` AND o.created_at <= $${paramCount}`
        params.push(to)
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(parseInt(limit), parseInt(offset))
    
    try {
        const result = await pool.query(query, params)
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total FROM orders.orders o
            JOIN public.menu_items m ON m.id = o.item_id
            WHERE o.student_id = $1
            ${status ? 'AND o.status = $2' : ''}
            ${search ? `AND m.name ILIKE $${status ? 3 : 2}` : ''}
        `
        const countParams = [studentId]
        if (status) countParams.push(status)
        if (search) countParams.push(`%${search}%`)
        const countResult = await pool.query(countQuery, countParams)
        
        res.json({ 
            orders: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        })
    } catch (err) {
        console.error('Order history error:', err)
        res.status(500).json({ message: 'Failed to fetch order history.' })
    }
})

// ─── REVIEWS ───────────────────────────────────────────────────
/**
 * POST /reviews
 * Submit a review for a completed order
 */
app.post('/reviews', requireAuth, async (req, res) => {
    const { orderId, rating, comment } = req.body
    const { studentId } = req.user
    
    if (!orderId || !rating) {
        return res.status(400).json({ message: 'orderId and rating are required.' })
    }
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5.' })
    }
    
    try {
        // Verify the order belongs to this student and is completed
        const orderCheck = await pool.query(
            `SELECT o.order_id, o.item_id, o.status FROM orders.orders o 
             WHERE o.order_id = $1 AND o.student_id = $2`,
            [orderId, studentId]
        )
        
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' })
        }
        
        const order = orderCheck.rows[0]
        if (order.status !== 'READY' && order.status !== 'COMPLETED' && order.status !== 'PICKED_UP') {
            return res.status(400).json({ message: 'Can only review completed orders.' })
        }
        
        // Insert or update review
        const result = await pool.query(
            `INSERT INTO public.reviews (order_id, student_id, item_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (order_id) DO UPDATE SET rating = $4, comment = $5
             RETURNING *`,
            [orderId, studentId, order.item_id, rating, comment || null]
        )
        
        res.json({ review: result.rows[0], message: 'Review submitted successfully.' })
    } catch (err) {
        console.error('Review error:', err)
        res.status(500).json({ message: 'Failed to submit review.' })
    }
})

/**
 * GET /menu/:itemId/reviews
 * Get reviews for a menu item
 */
app.get('/menu/:itemId/reviews', async (req, res) => {
    const { itemId } = req.params
    const { limit = 20, offset = 0 } = req.query
    
    try {
        const result = await pool.query(
            `SELECT r.id, r.rating, r.comment, r.created_at,
                    s.name as student_name, s.department
             FROM public.reviews r
             JOIN identity.students s ON s.student_id = r.student_id
             WHERE r.item_id = $1
             ORDER BY r.created_at DESC
             LIMIT $2 OFFSET $3`,
            [itemId, parseInt(limit), parseInt(offset)]
        )
        
        const statsResult = await pool.query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
             FROM public.reviews WHERE item_id = $1`,
            [itemId]
        )
        
        res.json({
            reviews: result.rows,
            stats: {
                avgRating: parseFloat(statsResult.rows[0].avg_rating) || 0,
                totalReviews: parseInt(statsResult.rows[0].total_reviews)
            }
        })
    } catch (err) {
        console.error('Get reviews error:', err)
        res.status(500).json({ message: 'Failed to fetch reviews.' })
    }
})

// ─── QR CODE VERIFICATION ──────────────────────────────────────
/**
 * POST /orders/verify-qr
 * Verify QR code at counter for pickup
 */
app.post('/orders/verify-qr', async (req, res) => {
    const { qrCode } = req.body
    
    if (!qrCode) {
        return res.status(400).json({ message: 'qrCode is required.' })
    }
    
    try {
        const result = await pool.query(
            `SELECT o.order_id, o.status, o.qr_code, o.pickup_verified, o.amount,
                    o.student_id, m.name as item_name, s.name as student_name
             FROM orders.orders o
             JOIN public.menu_items m ON m.id = o.item_id
             JOIN identity.students s ON s.student_id = o.student_id
             WHERE o.qr_code = $1`,
            [qrCode]
        )
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Invalid QR code.' })
        }
        
        const order = result.rows[0]
        
        if (order.pickup_verified) {
            return res.status(409).json({ message: 'Order already picked up.', order })
        }
        
        if (order.status !== 'READY') {
            return res.status(400).json({ message: `Order is not ready. Current status: ${order.status}`, order })
        }
        
        // Mark as picked up
        await pool.query(
            `UPDATE orders.orders SET pickup_verified = true, status = 'PICKED_UP', completed_at = NOW()
             WHERE order_id = $1`,
            [order.order_id]
        )
        
        res.json({ 
            message: 'Order verified! Ready for pickup.',
            order: { ...order, pickup_verified: true, status: 'PICKED_UP' }
        })
    } catch (err) {
        console.error('QR verification error:', err)
        res.status(500).json({ message: 'Failed to verify QR code.' })
    }
})

/**
 * GET /orders/:orderId/qr
 * Get QR code for an order
 */
app.get('/orders/:orderId/qr', requireAuth, async (req, res) => {
    const { orderId } = req.params
    const { studentId } = req.user
    
    try {
        const result = await pool.query(
            `SELECT qr_code, status FROM orders.orders WHERE order_id = $1 AND student_id = $2`,
            [orderId, studentId]
        )
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' })
        }
        
        res.json({ qrCode: result.rows[0].qr_code, status: result.rows[0].status })
    } catch (err) {
        res.status(500).json({ message: 'Failed to get QR code.' })
    }
})

// ─── SCHEDULED ORDERS (Pre-ordering) ───────────────────────────
/**
 * GET /time-slots
 * Get available pickup time slots
 */
app.get('/time-slots', (req, res) => {
    const now = new Date()
    const slots = []
    
    // Generate slots from 11:00 to 21:00 in 30-min intervals
    for (let hour = 11; hour <= 21; hour++) {
        for (let min = 0; min < 60; min += 30) {
            const slotTime = new Date(now)
            slotTime.setHours(hour, min, 0, 0)
            
            // Only show future slots (at least 30 mins from now)
            if (slotTime.getTime() > now.getTime() + 30 * 60 * 1000) {
                slots.push({
                    time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
                    label: `${hour > 12 ? hour - 12 : hour}:${min.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`,
                    datetime: slotTime.toISOString()
                })
            }
        }
    }
    
    res.json({ slots })
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