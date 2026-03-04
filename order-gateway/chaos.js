// chaos.js — add this to every service
// Exposes POST /chaos to simulate service failure for the Admin Dashboard
// Protected by admin JWT authentication — only admins can toggle chaos mode

const jwt = require('jsonwebtoken')

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.')
  process.exit(1)
}
const JWT_SECRET = process.env.JWT_SECRET

let isKilled = false

function chaosMiddleware(req, res, next) {
  // Allow /health, /chaos, /chaos/status, and /metrics even when killed
  const allowed = ['/health', '/chaos', '/chaos/status', '/metrics']
  if (isKilled && !allowed.includes(req.path)) {
    return res.status(503).json({ message: 'Service is currently disabled (chaos mode).' })
  }
  next()
}

/**
 * Verifies that the request has a valid admin JWT token.
 * Returns the decoded payload if valid, null otherwise.
 */
function verifyAdmin(req) {
  const authHeader = req.headers['authorization']
  let token = authHeader && authHeader.split(' ')[1]
  // Fallback: read token from httpOnly cookie
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('token='))
    if (match) token = match.split('=')[1].trim()
  }
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded.isAdmin ? decoded : null
  } catch {
    return null
  }
}

function chaosRoute(app) {
  // POST /chaos — admin-only, called by Admin Dashboard
  app.post('/chaos', (req, res) => {
    const admin = verifyAdmin(req)
    if (!admin) {
      return res.status(401).json({ message: 'Admin authentication required.' })
    }
    isKilled = req.body.killed === true
    console.log(`⚡ Chaos mode: ${isKilled ? 'KILLED' : 'RESTORED'} (by ${admin.username})`)
    res.json({ killed: isKilled, message: isKilled ? 'Service killed.' : 'Service restored.' })
  })

  // GET /chaos/status
  app.get('/chaos/status', (req, res) => {
    res.json({ killed: isKilled })
  })
}

module.exports = { chaosMiddleware, chaosRoute }
