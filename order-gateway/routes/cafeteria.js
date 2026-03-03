/**
 * Cafeteria Routes
 * Handles token booking for meals
 */
const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const { requireAuth } = require('../middleware/auth')
const { logger } = require('../lib/logger')

module.exports = function createCafeteriaRoutes(pool) {
  const TOKEN_PRICE = { dinner: 120.0, iftar: 100.0 }

  // POST /cafeteria/tokens/bulk
  router.post('/tokens/bulk', requireAuth, async (req, res) => {
    const { tokens } = req.body
    const { studentId } = req.user

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ message: 'tokens array is required.' })
    }

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
          message: `Insufficient balance. You have ৳${balance.toFixed(2)} but need ৳${totalCost.toFixed(2)} for ${tokens.length} token(s).`,
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

      if (inserted === 0) {
        return res.status(409).json({ message: 'All selected tokens already exist.' })
      }

      const actualCost = insertedTokens.reduce((sum, t) => sum + (TOKEN_PRICE[t.type] || 120), 0)
      const newBalance = balance - actualCost

      await pool.query(
        `INSERT INTO public.transactions (student_id, type, amount, balance_after, description, order_id)
         VALUES ($1, 'debit', $2, $3, $4, $5)`,
        [studentId, actualCost, newBalance, `Token booking: ${inserted} meal token(s)`, orderId]
      )

      logger.info(
        { correlationId: req.correlationId, studentId, tokenCount: inserted, cost: actualCost },
        'Tokens booked'
      )

      res.status(202).json({
        orderId,
        inserted,
        totalCost: actualCost,
        newBalance,
        message: `${inserted} token(s) booked. ৳${actualCost.toFixed(2)} deducted from wallet.`,
      })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Token booking error')
      res.status(500).json({ message: 'Failed to book tokens.' })
    }
  })

  // GET /cafeteria/tokens
  router.get('/tokens', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT type, meal_date as date, is_used FROM orders.tokens
         WHERE student_id = $1 AND meal_date >= CURRENT_DATE AND is_used = false
         ORDER BY meal_date ASC`,
        [req.user.studentId]
      )
      res.json({ tokens: result.rows })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Tokens fetch error')
      res.status(500).json({ message: 'Failed to fetch tokens.' })
    }
  })

  // GET /cafeteria/purchases
  router.get('/purchases', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT meal_date as date, type, status FROM orders.orders
         WHERE student_id = $1 AND status != 'FAILED'
         ORDER BY meal_date DESC LIMIT 60`,
        [req.user.studentId]
      )
      res.json({ purchases: result.rows })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Purchases fetch error')
      res.status(500).json({ message: 'Failed to fetch purchases.' })
    }
  })

  return router
}
