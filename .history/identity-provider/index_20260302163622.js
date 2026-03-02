const express    = require('express')
const bcrypt     = require('bcryptjs')
const jwt        = require('jsonwebtoken')
const cors       = require('cors')
const rateLimit  = require('express-rate-limit')
require('dotenv').config()

const JWT_SECRET = process.env.JWT_SECRET || 'iut-cafeteria-super-secret-2026'

const pool = require('./db')
const app  = express()

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:80',
    'http://localhost',
  ],
  credentials: true,
}))
app.use(express.json())

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

// ─── Rate Limiter (bonus requirement: 3 attempts per minute per student) ──
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000, // 1 minute
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 3,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: { message: 'Too many login attempts. Please wait 1 minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── Metrics (in-memory) ───────────────────────────────────────
const metrics = {
  totalLogins:   0,
  failedLogins:  0,
  totalLatency:  0,
  requestCount:  0,
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
      return res.status(403).json({ message: 'Your account has been deactivated. Contact the registrar.' })
    }

    // ── Verify password ──
    const passwordMatch = await bcrypt.compare(password, student.password_hash)

    if (!passwordMatch) {
      metrics.failedLogins++
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    // ── Issue JWT ──
    const payload = {
      studentId:  student.student_id,
      email:      student.email,
      name:       student.name,
      department: student.department,
      year:       student.year,
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
    })

    return res.status(200).json({
      token,
      user: payload,
    })

  } catch (err) {
    console.error('Login error:', err)
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
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' })
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
    const payload = { adminId: admin.id, username: admin.username, fullName: admin.full_name, role: admin.role, isAdmin: true }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    // Set JWT as httpOnly cookie (frontend expects this)
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    })
    return res.status(200).json({ token, admin: payload })
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
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' })
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

    const ordersResult = await pool.query(`
      SELECT o.order_id, o.status, o.amount, o.created_at, m.name as item_name
      FROM orders.orders o
      JOIN public.menu_items m ON m.id = o.item_id
      WHERE o.student_id = $1
      ORDER BY o.created_at DESC
      LIMIT 50
    `, [studentId])

    const transactionsResult = await pool.query(`
      SELECT id, type, amount, balance_after, description, created_at
      FROM public.transactions
      WHERE student_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [studentId])

    res.json({
      user: userResult.rows[0],
      orders: ordersResult.rows,
      transactions: transactionsResult.rows
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
    res.json({ message: is_active ? 'Account reactivated.' : 'Account suspended.', user: result.rows[0] })
  } catch (err) {
    console.error('Update user status error:', err)
    res.status(500).json({ message: 'Failed to update user status.' })
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
      status:    'healthy',
      service:   'identity-provider',
      database:  'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(503).json({
      status:    'unhealthy',
      service:   'identity-provider',
      database:  'disconnected',
      reason:    err.message,
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * GET /metrics
 */
app.get('/metrics', (req, res) => {
  res.status(200).json({
    totalLogins:      metrics.totalLogins,
    failedLogins:     metrics.failedLogins,
    averageLatencyMs: metrics.requestCount > 0
        ? Math.round(metrics.totalLatency / metrics.requestCount)
        : 0,
    uptime: process.uptime(),
  })
})

// ─── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🔐 Identity Provider running on http://localhost:${PORT}`)
  console.log(`   POST /login    — authenticate student`)
  console.log(`   POST /register — create student account`)
  console.log(`   POST /verify   — validate JWT token`)
  console.log(`   GET  /health   — service health check`)
  console.log(`   GET  /metrics  — performance metrics`)
})