/**
 * Wallet Routes
 * Handles balance, transactions, top-up, and emergency balance
 */
const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { logger } = require('../lib/logger')
const { incCounter, METRICS } = require('../lib/metrics')

const EMERGENCY_LIMIT = 1000

module.exports = function createWalletRoutes(pool) {
  // GET /wallet/balance
  router.get('/balance', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COALESCE(balance, 0) as balance
         FROM public.wallet_balances_materialized WHERE student_id = $1`,
        [req.user.studentId]
      )
      const balance = result.rows.length > 0 ? parseFloat(result.rows[0].balance) : 0
      res.json({ balance })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Balance fetch error')
      res.status(500).json({ message: 'Failed to fetch balance.' })
    }
  })

  // GET /wallet/transactions
  router.get('/transactions', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT type, amount, balance_after, description, created_at
         FROM public.transactions WHERE student_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.user.studentId]
      )
      res.json({ transactions: result.rows })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'Transactions fetch error'
      )
      res.status(500).json({ message: 'Failed to fetch transactions.' })
    }
  })

  // POST /wallet/topup
  router.post('/topup', requireAuth, async (req, res) => {
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
        bkash: 'bKash Top-up',
        nagad: 'Nagad Top-up',
        rocket: 'Rocket Top-up',
        bank: 'Bank Transfer',
      }
      const description = `${methodLabels[method] || 'Wallet Top-up'}${reference ? ` · ${reference}` : ''}`

      await pool.query(
        `INSERT INTO public.transactions (student_id, type, amount, balance_after, description)
         VALUES ($1, 'credit', $2, $3, $4)`,
        [studentId, amt, newBalance, description]
      )

      await pool.query(
        `INSERT INTO public.wallet_balances_materialized (student_id, balance, last_updated)
         VALUES ($1, $2, NOW())
         ON CONFLICT (student_id) DO UPDATE SET balance = $2, last_updated = NOW()`,
        [studentId, newBalance]
      )

      incCounter(METRICS.WALLET_TOPUPS_TOTAL, { method })
      logger.info(
        { correlationId: req.correlationId, studentId, amount: amt, method },
        'Wallet top-up successful'
      )

      return res
        .status(200)
        .json({ message: 'Wallet topped up successfully.', amount: amt, newBalance, method })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Top-up error')
      return res.status(500).json({ message: 'Top-up failed. Please try again.' })
    }
  })

  // GET /wallet/emergency/status
  router.get('/emergency/status', requireAuth, async (req, res) => {
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
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'Emergency status error'
      )
      res.status(500).json({ message: 'Failed to check emergency balance.' })
    }
  })

  // POST /wallet/emergency/request
  router.post('/emergency/request', requireAuth, async (req, res) => {
    const { studentId } = req.user
    const { amount, reason } = req.body

    if (!amount || isNaN(amount) || parseFloat(amount) < 10) {
      return res.status(400).json({ message: 'Minimum emergency balance is ৳10.' })
    }

    const amt = parseFloat(parseFloat(amount).toFixed(2))

    try {
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

      const balResult = await pool.query(
        `SELECT COALESCE(balance, 0) AS balance
         FROM public.wallet_balances_materialized WHERE student_id = $1`,
        [studentId]
      )
      const currentBalance = balResult.rows.length > 0 ? parseFloat(balResult.rows[0].balance) : 0
      const newBalance = parseFloat((currentBalance + amt).toFixed(2))

      await pool.query(
        `INSERT INTO public.emergency_loans (student_id, amount, reason)
         VALUES ($1, $2, $3)`,
        [studentId, amt, reason || 'Emergency balance request']
      )

      await pool.query(
        `INSERT INTO public.transactions (student_id, type, amount, balance_after, description)
         VALUES ($1, 'credit', $2, $3, $4)`,
        [studentId, amt, newBalance, 'Emergency Advance · Will be deducted from monthly allowance']
      )

      await pool.query(
        `INSERT INTO public.wallet_balances_materialized (student_id, balance, last_updated)
         VALUES ($1, $2, NOW())
         ON CONFLICT (student_id) DO UPDATE SET balance = $2, last_updated = NOW()`,
        [studentId, newBalance]
      )

      const newOutstanding = outstanding + amt
      const newAvailable = EMERGENCY_LIMIT - newOutstanding

      logger.info(
        { correlationId: req.correlationId, studentId, amount: amt },
        'Emergency balance added'
      )

      return res.status(200).json({
        message: 'Emergency balance added successfully.',
        amount: amt,
        newBalance,
        outstanding: newOutstanding,
        available: newAvailable,
        limit: EMERGENCY_LIMIT,
      })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'Emergency request error'
      )
      return res.status(500).json({ message: 'Failed to process emergency balance.' })
    }
  })

  return router
}
