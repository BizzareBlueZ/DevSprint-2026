const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const webpush = require('web-push')
require('dotenv').config()

// ─── Observability ─────────────────────────────────────────────
const { logger } = require('./lib/logger')
const {
  incCounter,
  observeHistogram,
  toPrometheusFormat,
  toJSON,
  METRICS,
} = require('./lib/metrics')
const { correlationIdMiddleware } = require('./middleware/correlationId')

if (!process.env.JWT_SECRET) {
  logger.fatal('FATAL: JWT_SECRET environment variable is not set. Refusing to start.')
  process.exit(1)
}
const JWT_SECRET = process.env.JWT_SECRET

// ─── Web Push VAPID Configuration ─────────────────────────────
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  logger.fatal(
    'FATAL: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables are not set. Refusing to start.'
  )
  process.exit(1)
}
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

webpush.setVapidDetails('mailto:admin@iut-cafeteria.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const pool = require('./db')
const app = express()

// ─── Middleware ────────────────────────────────────────────────
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:80', 'http://localhost'],
    credentials: true,
  })
)
app.use(express.json())

// ─── Observability Middleware ──────────────────────────────────
app.use(correlationIdMiddleware)

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

// ─── Rate Limiter (bonus requirement: 3 attempts per minute per student) ──
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX) || 3,
  keyGenerator: req => req.body?.email || req.ip,
  message: { message: 'Too many login attempts. Please wait 1 minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── Metrics (in-memory) ───────────────────────────────────────
const metrics = {
  totalLogins: 0,
  failedLogins: 0,
  totalLatency: 0,
  requestCount: 0,
}

// ─── JWT Auth Middleware ───────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  let token = authHeader && authHeader.split(' ')[1]

  // Fallback: read token from httpOnly cookie
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('token='))
    if (match) token = match.split('=')[1].trim()
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

// ─── Routes ───────────────────────────────────────────────────

/**
 * POST /login
 * Body: { email: "230042135@iut-dhaka.edu", password: "password123" }
 * Returns: { token, user: { studentId, email, name, department, year } }
 */
app.post('/login', loginLimiter, async (req, res) => {
  const start = Date.now()
  const { email, password } = req.body

  // ── Validate input ──
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  // Accept both formats: "230042135" or "230042135@iut-dhaka.edu"
  const normalizedEmail = email.includes('@')
    ? email.toLowerCase().trim()
    : `${email.trim()}@iut-dhaka.edu`

  try {
    // ── Look up student ──
    const result = await pool.query(
      'SELECT id, student_id, email, password_hash, name, department, year, is_active FROM identity.students WHERE email = $1',
      [normalizedEmail]
    )

    const student = result.rows[0]

    if (!student) {
      metrics.failedLogins++
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    if (!student.is_active) {
      return res
        .status(403)
        .json({ message: 'Your account has been deactivated. Contact the registrar.' })
    }

    // ── Verify password ──
    const passwordMatch = await bcrypt.compare(password, student.password_hash)

    if (!passwordMatch) {
      metrics.failedLogins++
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    // ── Issue JWT ──
    const payload = {
      studentId: student.student_id,
      email: student.email,
      name: student.name,
      department: student.department,
      year: student.year,
    }

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    })

    // ── Track metrics ──
    metrics.totalLogins++
    metrics.requestCount++
    metrics.totalLatency += Date.now() - start

    // Set JWT as httpOnly cookie (frontend expects this)
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === 'production' || process.env.ENABLE_HTTPS === 'true',
    })

    return res.status(200).json({
      user: payload,
    })
  } catch (err) {
    logger.error({ correlationId: req.correlationId, error: err.message }, 'Login error')
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

/**
 * POST /register
 * Body: { studentId, email, password, name, department, year }
 * Returns: { message, user }
 */
app.post('/register', async (req, res) => {
  const { studentId, email, password, name, department = 'CSE', year = 1 } = req.body

  if (!studentId || !email || !password || !name) {
    return res.status(400).json({ message: 'studentId, email, password and name are required.' })
  }

  // Enforce IUT email format
  if (!email.endsWith('@iut-dhaka.edu')) {
    return res.status(400).json({ message: 'Must use an @iut-dhaka.edu email address.' })
  }

  // Password strength validation
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' })
  }
  if (!/[a-zA-Z]/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one letter.' })
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one digit.' })
  }
  if (!/[^a-zA-Z0-9\s]/.test(password)) {
    return res
      .status(400)
      .json({ message: 'Password must contain at least one special character (!@#$%^&* etc.).' })
  }

  try {
    // Check if already exists
    const existing = await pool.query(
      'SELECT id FROM identity.students WHERE email = $1 OR student_id = $2',
      [email.toLowerCase(), studentId]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'A student with this email or ID already exists.' })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert
    await pool.query(
      `INSERT INTO identity.students (student_id, email, password_hash, name, department, year)
         VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentId, email.toLowerCase(), passwordHash, name, department, parseInt(year)]
    )

    return res.status(201).json({
      message: 'Registration successful.',
      user: { studentId, email, name, department, year },
    })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

/**
 * POST /verify
 * Validates a JWT token (called internally by Order Gateway)
 * Header: Authorization: Bearer <token>
 * Returns: { valid: true, user: {...} } or 401
 */
app.post('/verify', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ valid: false, message: 'No token provided.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return res.status(200).json({ valid: true, user: decoded })
  } catch (err) {
    return res.status(401).json({ valid: false, message: 'Invalid or expired token.' })
  }
})

/**
 * POST /admin/login
 * Authenticates admin users against the admins table
 */
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required.' })
  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash, full_name, role, is_active FROM identity.admins WHERE username = $1',
      [username.toLowerCase().trim()]
    )
    const admin = result.rows[0]
    if (!admin) return res.status(401).json({ message: 'Invalid credentials.' })
    if (!admin.is_active) return res.status(403).json({ message: 'Admin account is deactivated.' })
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials.' })
    await pool.query('UPDATE identity.admins SET last_login_at = NOW() WHERE id = $1', [admin.id])
    const payload = {
      adminId: admin.id,
      username: admin.username,
      fullName: admin.full_name,
      role: admin.role,
      isAdmin: true,
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    // Set JWT as httpOnly cookie (frontend expects this)
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      secure: process.env.NODE_ENV === 'production' || process.env.ENABLE_HTTPS === 'true',
    })
    return res.status(200).json({ admin: payload })
  } catch (err) {
    console.error('Admin login error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

/**
 * POST /logout
 * Clears the httpOnly JWT cookie
 */
app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production' || process.env.ENABLE_HTTPS === 'true',
  })
  return res.status(200).json({ message: 'Logged out successfully.' })
})

// ══════════════════════════════════════════════════════════════
// ADMIN: User Management APIs
// ══════════════════════════════════════════════════════════════

/**
 * GET /admin/users
 * List all students with their activity
 */
app.get('/admin/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.student_id, s.email, s.name, s.department, s.year, 
             s.is_active, s.created_at, s.updated_at,
             (SELECT COUNT(*) FROM orders.orders o WHERE o.student_id = s.student_id) as order_count,
             (SELECT SUM(amount) FROM orders.orders o WHERE o.student_id = s.student_id AND o.status != 'FAILED') as total_spent
      FROM identity.students s
      ORDER BY s.created_at DESC
    `)
    res.json({ users: result.rows })
  } catch (err) {
    console.error('Fetch users error:', err)
    res.status(500).json({ message: 'Failed to fetch users.' })
  }
})

/**
 * GET /admin/users/:studentId
 * Get detailed activity for a specific student
 */
app.get('/admin/users/:studentId', async (req, res) => {
  const { studentId } = req.params
  try {
    const userResult = await pool.query(
      'SELECT id, student_id, email, name, department, year, is_active, created_at FROM identity.students WHERE student_id = $1',
      [studentId]
    )
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found.' })

    const ordersResult = await pool.query(
      `
      SELECT o.order_id, o.status, o.amount, o.created_at, m.name as item_name
      FROM orders.orders o
      JOIN public.menu_items m ON m.id = o.item_id
      WHERE o.student_id = $1
      ORDER BY o.created_at DESC
      LIMIT 50
    `,
      [studentId]
    )

    const transactionsResult = await pool.query(
      `
      SELECT id, type, amount, balance_after, description, created_at
      FROM public.transactions
      WHERE student_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
      [studentId]
    )

    res.json({
      user: userResult.rows[0],
      orders: ordersResult.rows,
      transactions: transactionsResult.rows,
    })
  } catch (err) {
    console.error('Fetch user detail error:', err)
    res.status(500).json({ message: 'Failed to fetch user details.' })
  }
})

/**
 * PUT /admin/users/:studentId/status
 * Suspend or reactivate a student account
 */
app.put('/admin/users/:studentId/status', async (req, res) => {
  const { studentId } = req.params
  const { is_active } = req.body
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ message: 'is_active (boolean) is required.' })
  }
  try {
    const result = await pool.query(
      'UPDATE identity.students SET is_active = $1, updated_at = NOW() WHERE student_id = $2 RETURNING student_id, name, is_active',
      [is_active, studentId]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found.' })
    res.json({
      message: is_active ? 'Account reactivated.' : 'Account suspended.',
      user: result.rows[0],
    })
  } catch (err) {
    console.error('Update user status error:', err)
    res.status(500).json({ message: 'Failed to update user status.' })
  }
})

// ─── PUSH NOTIFICATIONS ────────────────────────────────────────

/**
 * POST /push/subscribe
 * Subscribe to push notifications
 */
app.post('/push/subscribe', requireAuth, async (req, res) => {
  const { subscription } = req.body
  const { studentId } = req.user

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ message: 'Invalid subscription object.' })
  }

  try {
    await pool.query(
      `INSERT INTO identity.push_subscriptions (student_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
      [studentId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    )

    res.json({ message: 'Push subscription saved.' })
  } catch (err) {
    console.error('Push subscribe error:', err)
    res.status(500).json({ message: 'Failed to save push subscription.' })
  }
})

/**
 * DELETE /push/unsubscribe
 * Unsubscribe from push notifications
 */
app.delete('/push/unsubscribe', requireAuth, async (req, res) => {
  const { studentId } = req.user

  try {
    await pool.query(`DELETE FROM identity.push_subscriptions WHERE student_id = $1`, [studentId])

    res.json({ message: 'Push subscription removed.' })
  } catch (err) {
    console.error('Push unsubscribe error:', err)
    res.status(500).json({ message: 'Failed to remove push subscription.' })
  }
})

/**
 * GET /push/status
 * Check push subscription status
 */
app.get('/push/status', requireAuth, async (req, res) => {
  const { studentId } = req.user

  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM identity.push_subscriptions WHERE student_id = $1`,
      [studentId]
    )

    res.json({ subscribed: parseInt(result.rows[0].count) > 0 })
  } catch (err) {
    res.status(500).json({ message: 'Failed to check push status.' })
  }
})

/**
 * GET /push/vapid-key
 * Get VAPID public key for Web Push
 */
app.get('/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY })
})

/**
 * POST /push/send
 * Send push notification to a specific student
 */
app.post('/push/send', async (req, res) => {
  const { studentId, title, body, data } = req.body

  if (!studentId || !title) {
    return res.status(400).json({ message: 'studentId and title are required.' })
  }

  try {
    const result = await pool.query(
      'SELECT endpoint, p256dh, auth FROM identity.push_subscriptions WHERE student_id = $1',
      [studentId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No push subscription found for this student.' })
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      icon: '/iut-logo.png',
      badge: '/badge.png',
      data: data || {},
    })

    const sendPromises = result.rows.map(async sub => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }
      try {
        await webpush.sendNotification(subscription, payload)
        return { success: true }
      } catch (err) {
        // Remove invalid subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM identity.push_subscriptions WHERE endpoint = $1', [
            sub.endpoint,
          ])
        }
        return { success: false, error: err.message }
      }
    })

    const results = await Promise.all(sendPromises)
    const successCount = results.filter(r => r.success).length

    res.json({
      message: `Sent to ${successCount}/${results.length} subscriptions`,
      sent: successCount,
      total: results.length,
    })
  } catch (err) {
    console.error('Push notification error:', err)
    res.status(500).json({ message: 'Failed to send push notification.' })
  }
})

/**
 * GET /health
 * Returns service + DB health status
 */
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({
      status: 'healthy',
      service: 'identity-provider',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'identity-provider',
      database: 'disconnected',
      reason: err.message,
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * GET /metrics
 */
app.get('/metrics', (req, res) => {
  const metricsData = toJSON()
  metricsData.uptime = process.uptime()
  res.status(200).json(metricsData)
})

/**
 * GET /metrics/prometheus
 */
app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(toPrometheusFormat())
})

// ─── Start ─────────────────────────────────────────────────────
const { gracefulShutdown } = require('./lib/gracefulShutdown')

const PORT = process.env.PORT || 3001
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Identity Provider started')
})

gracefulShutdown(server, {
  logger,
  onShutdown: async () => {
    await pool.end()
  },
})
