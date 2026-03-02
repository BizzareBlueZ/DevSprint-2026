// ─── ADD THIS ROUTE to order-gateway/index.js ─────────────────
// Place it after the GET /wallet/transactions route

/**
 * POST /wallet/topup
 * Body: { amount, method, reference }
 * Simulates a mobile banking / bank transfer top-up
 * Credits the student's wallet and records the transaction
 */
app.post('/wallet/topup', requireAuth, async (req, res) => {
  const { amount, method = 'bkash', reference } = req.body
  const { studentId } = req.user

  if (!amount || isNaN(amount) || parseFloat(amount) < 10) {
    return res.status(400).json({ message: 'Minimum top-up amount is ৳10.' })
  }

  const amt = parseFloat(parseFloat(amount).toFixed(2))

  try {
    // Get current balance
    const balResult = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
       FROM transactions WHERE student_id = $1`,
      [studentId]
    )
    const currentBalance = parseFloat(balResult.rows[0].balance)
    const newBalance = parseFloat((currentBalance + amt).toFixed(2))

    // Insert credit transaction
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

    return res.status(200).json({
      message:    'Wallet topped up successfully.',
      amount:     amt,
      newBalance,
      method,
    })
  } catch (err) {
    console.error('Top-up error:', err)
    return res.status(500).json({ message: 'Top-up failed. Please try again.' })
  }
})