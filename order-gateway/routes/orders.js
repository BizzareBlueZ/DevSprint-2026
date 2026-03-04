/**
 * Orders Routes
 * Handles order creation, history, QR verification, and time slots
 */
const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const axios = require('axios')
const QRCode = require('qrcode')
const { requireAuth } = require('../middleware/auth')
const { getCorrelationHeaders } = require('../middleware/correlationId')
const { logger } = require('../lib/logger')
const { incCounter, observeHistogram, recordLatency, METRICS } = require('../lib/metrics')

module.exports = function createOrderRoutes(
  pool,
  { redisClient, rabbitChannel, simulateKitchen, STOCK_SERVICE_URL }
) {
  // POST /orders
  router.post('/', requireAuth, async (req, res) => {
    const start = Date.now()
    const { itemId, type = 'dinner', scheduledPickupTime } = req.body
    const { studentId } = req.user
    const idempotencyKey = req.headers['x-idempotency-key'] || null

    if (!itemId) return res.status(400).json({ message: 'itemId is required.' })

    // Idempotency check
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
        logger.error(
          { correlationId: req.correlationId, error: err.message },
          'Idempotency lookup error'
        )
      }
    }

    const orderId = uuidv4()

    try {
      // Check Redis cache for stock
      if (redisClient) {
        const cached = await redisClient.get(`stock:${itemId}`).catch(() => null)
        if (cached === '0') {
          incCounter(METRICS.ORDERS_FAILED, { reason: 'out_of_stock' })
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
          message: `Insufficient balance. You have ৳${balance.toFixed(2)} but need ৳${item.price}.`,
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

      // Stock decrement
      try {
        await axios.post(
          `${STOCK_SERVICE_URL}/stock/${itemId}/decrement`,
          { orderId },
          { timeout: 3000, headers: getCorrelationHeaders(req) }
        )
      } catch (err) {
        await pool.query("UPDATE orders.orders SET status = 'FAILED' WHERE order_id = $1", [
          orderId,
        ])
        await pool.query(
          `INSERT INTO public.transactions (student_id, type, amount, balance_after, description, order_id)
           VALUES ($1, 'credit', $2, $3, 'Refund: stock unavailable', $4)`,
          [studentId, item.price, balance, orderId]
        )
        incCounter(METRICS.ORDERS_FAILED, { reason: 'stock_unavailable' })
        return res.status(409).json({ message: err.response?.data?.message || 'Out of stock.' })
      }

      await pool.query(
        "UPDATE orders.orders SET status = 'STOCK_VERIFIED', acknowledged_at = NOW() WHERE order_id = $1",
        [orderId]
      )

      const orderMsg = {
        orderId,
        studentId,
        itemId,
        itemName: item.name,
        type,
        timestamp: new Date().toISOString(),
      }
      if (rabbitChannel) {
        rabbitChannel.sendToQueue('orders', Buffer.from(JSON.stringify(orderMsg)), {
          persistent: true,
        })
      } else {
        simulateKitchen(orderMsg)
      }

      const latency = Date.now() - start
      incCounter(METRICS.ORDERS_TOTAL, { type })
      recordLatency(latency)
      observeHistogram(METRICS.HTTP_REQUEST_DURATION_MS, latency, { route: 'POST /orders' })

      logger.info(
        { correlationId: req.correlationId, orderId, studentId, itemId, latencyMs: latency },
        'Order created successfully'
      )

      return res
        .status(202)
        .json({ orderId, message: 'Order received! Track your status below.', item: item.name })
    } catch (err) {
      // Handle unique constraint violation on idempotency_key
      if (err.code === '23505' && err.constraint && idempotencyKey) {
        const existing = await pool
          .query(
            `SELECT o.order_id, o.status, m.name as item_name
           FROM orders.orders o JOIN public.menu_items m ON m.id = o.item_id
           WHERE o.idempotency_key = $1`,
            [idempotencyKey]
          )
          .catch(() => ({ rows: [] }))
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
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Order error')
      incCounter(METRICS.ORDERS_FAILED, { reason: 'internal_error' })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  })

  // GET /orders
  router.get('/', requireAuth, async (req, res) => {
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
        offset: parseInt(offset),
      })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Order history error')
      res.status(500).json({ message: 'Failed to fetch order history.' })
    }
  })

  // GET /orders/:orderId
  router.get('/:orderId', requireAuth, async (req, res) => {
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
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Order fetch error')
      res.status(500).json({ message: 'Failed to fetch order.' })
    }
  })

  // GET /orders/:orderId/qr
  router.get('/:orderId/qr', requireAuth, async (req, res) => {
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
      logger.error({ correlationId: req.correlationId, error: err.message }, 'QR fetch error')
      res.status(500).json({ message: 'Failed to get QR code.' })
    }
  })

  // GET /orders/:orderId/qr/image - Returns QR code as PNG image
  router.get('/:orderId/qr/image', requireAuth, async (req, res) => {
    const { orderId } = req.params
    const { studentId } = req.user
    const { size = 200 } = req.query

    try {
      const result = await pool.query(
        `SELECT qr_code, status FROM orders.orders WHERE order_id = $1 AND student_id = $2`,
        [orderId, studentId]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found.' })
      }

      const qrCode = result.rows[0].qr_code

      // Generate QR code as PNG buffer
      const qrBuffer = await QRCode.toBuffer(qrCode, {
        type: 'png',
        width: Math.min(Math.max(parseInt(size) || 200, 100), 500),
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })

      res.set('Content-Type', 'image/png')
      res.set('Cache-Control', 'public, max-age=3600')
      res.send(qrBuffer)
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'QR image generation error'
      )
      res.status(500).json({ message: 'Failed to generate QR code image.' })
    }
  })

  // GET /orders/:orderId/qr/svg - Returns QR code as SVG
  router.get('/:orderId/qr/svg', requireAuth, async (req, res) => {
    const { orderId } = req.params
    const { studentId } = req.user
    const { size = 200 } = req.query

    try {
      const result = await pool.query(
        `SELECT qr_code, status FROM orders.orders WHERE order_id = $1 AND student_id = $2`,
        [orderId, studentId]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found.' })
      }

      const qrCode = result.rows[0].qr_code

      // Generate QR code as SVG
      const svgString = await QRCode.toString(qrCode, {
        type: 'svg',
        width: Math.min(Math.max(parseInt(size) || 200, 100), 500),
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })

      res.set('Content-Type', 'image/svg+xml')
      res.set('Cache-Control', 'public, max-age=3600')
      res.send(svgString)
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'QR SVG generation error'
      )
      res.status(500).json({ message: 'Failed to generate QR code.' })
    }
  })

  // POST /orders/verify-qr
  router.post('/verify-qr', async (req, res) => {
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
        return res
          .status(400)
          .json({ message: `Order is not ready. Current status: ${order.status}`, order })
      }

      await pool.query(
        `UPDATE orders.orders SET pickup_verified = true, status = 'PICKED_UP', completed_at = NOW()
         WHERE order_id = $1`,
        [order.order_id]
      )

      logger.info(
        { correlationId: req.correlationId, orderId: order.order_id },
        'Order picked up via QR'
      )

      res.json({
        message: 'Order verified! Ready for pickup.',
        order: { ...order, pickup_verified: true, status: 'PICKED_UP' },
      })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'QR verification error'
      )
      res.status(500).json({ message: 'Failed to verify QR code.' })
    }
  })

  return router
}
