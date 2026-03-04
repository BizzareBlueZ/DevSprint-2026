/**
 * JWT Authentication Middleware
 * Validates tokens from Authorization header or httpOnly cookies
 */
const jwt = require('jsonwebtoken')
const { logger } = require('../lib/logger')

const JWT_SECRET = process.env.JWT_SECRET

/**
 * Middleware that requires a valid JWT token
 * Supports both Authorization header and httpOnly cookies
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  let token = authHeader && authHeader.split(' ')[1]

  // Fallback: read token from httpOnly cookie
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('token='))
    if (match) token = match.split('=')[1].trim()
  }

  if (!token) {
    logger.warn(
      { correlationId: req.correlationId, event: 'auth_failed', reason: 'no_token' },
      'No token provided'
    )
    return res.status(401).json({ message: 'No token provided.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    // Normalize student ID from various token formats
    const normalizedStudentId =
      decoded?.studentId ||
      decoded?.student_id ||
      (typeof decoded?.email === 'string' && decoded.email.includes('@')
        ? decoded.email.split('@')[0]
        : null)

    req.user = {
      ...decoded,
      studentId: normalizedStudentId,
    }

    if (!req.user.studentId) {
      logger.warn(
        { correlationId: req.correlationId, event: 'auth_failed', reason: 'invalid_payload' },
        'Invalid token payload: missing student identifier'
      )
      return res.status(401).json({ message: 'Invalid token payload: missing student identifier.' })
    }

    next()
  } catch (err) {
    logger.warn(
      {
        correlationId: req.correlationId,
        event: 'auth_failed',
        reason: 'invalid_token',
        error: err.message,
      },
      'Invalid or expired token'
    )
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

/**
 * Optional auth middleware - doesn't fail if no token, but attaches user if present
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  let token = authHeader && authHeader.split(' ')[1]

  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('token='))
    if (match) token = match.split('=')[1].trim()
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      const normalizedStudentId =
        decoded?.studentId ||
        decoded?.student_id ||
        (typeof decoded?.email === 'string' && decoded.email.includes('@')
          ? decoded.email.split('@')[0]
          : null)

      req.user = { ...decoded, studentId: normalizedStudentId }
    } catch {
      // Ignore invalid tokens in optional auth
    }
  }

  next()
}

module.exports = { requireAuth, optionalAuth }
