/**
 * Reviews Routes
 * Handles order reviews and ratings
 */
const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { logger } = require('../lib/logger')

module.exports = function createReviewRoutes(pool) {
  // POST /reviews
  router.post('/', requireAuth, async (req, res) => {
    const { orderId, rating, comment } = req.body
    const { studentId } = req.user

    if (!orderId || !rating) {
      return res.status(400).json({ message: 'orderId and rating are required.' })
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' })
    }

    try {
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

      const result = await pool.query(
        `INSERT INTO public.reviews (order_id, student_id, item_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id) DO UPDATE SET rating = $4, comment = $5
         RETURNING *`,
        [orderId, studentId, order.item_id, rating, comment || null]
      )

      logger.info(
        { correlationId: req.correlationId, orderId, studentId, rating },
        'Review submitted'
      )

      res.json({ review: result.rows[0], message: 'Review submitted successfully.' })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Review error')
      res.status(500).json({ message: 'Failed to submit review.' })
    }
  })

  return router
}
