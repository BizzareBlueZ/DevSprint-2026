/**
 * Pure validation functions for identity-provider.
 * Extracted for unit testing without DB/auth dependencies.
 */

/**
 * Validates login request body.
 * @param {object} body
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLoginRequest(body = {}) {
  if (!body.email || typeof body.email !== 'string' || body.email.trim().length === 0) {
    return { valid: false, error: 'Email is required.' }
  }
  if (!body.password || typeof body.password !== 'string' || body.password.trim().length === 0) {
    return { valid: false, error: 'Password is required.' }
  }
  return { valid: true }
}

/**
 * Normalizes email input — accepts bare student IDs or full emails.
 * "230042135" → "230042135@iut-dhaka.edu"
 * "230042135@iut-dhaka.edu" → "230042135@iut-dhaka.edu"
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  if (typeof email !== 'string') return ''
  return email.includes('@')
    ? email.toLowerCase().trim()
    : `${email.trim()}@iut-dhaka.edu`
}

/**
 * Validates registration request body.
 * @param {object} body
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRegisterRequest(body = {}) {
  const { studentId, email, password, name } = body

  if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
    return { valid: false, error: 'studentId is required.' }
  }
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return { valid: false, error: 'email is required.' }
  }
  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    return { valid: false, error: 'password is required.' }
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'name is required.' }
  }
  if (!email.endsWith('@iut-dhaka.edu')) {
    return { valid: false, error: 'Must use an @iut-dhaka.edu email address.' }
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.' }
  }
  return { valid: true }
}

/**
 * Validates admin login request body.
 * @param {object} body
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAdminLoginRequest(body = {}) {
  if (!body.username || typeof body.username !== 'string' || body.username.trim().length === 0) {
    return { valid: false, error: 'Username is required.' }
  }
  if (!body.password || typeof body.password !== 'string' || body.password.trim().length === 0) {
    return { valid: false, error: 'Password is required.' }
  }
  return { valid: true }
}

/**
 * Validates a JWT token string format (basic structural check).
 * @param {string} authHeader - The Authorization header value
 * @returns {{ valid: boolean, token?: string, error?: string }}
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return { valid: false, error: 'No authorization header provided.' }
  }
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { valid: false, error: 'Invalid authorization header format. Expected: Bearer <token>' }
  }
  if (!parts[1] || parts[1].trim().length === 0) {
    return { valid: false, error: 'Token is empty.' }
  }
  return { valid: true, token: parts[1] }
}

module.exports = {
  validateLoginRequest,
  normalizeEmail,
  validateRegisterRequest,
  validateAdminLoginRequest,
  extractBearerToken,
}
