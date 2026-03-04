/**
 * Input Sanitization Utilities
 *
 * These utilities provide XSS protection by sanitizing user input on the frontend.
 * However, ALWAYS validate and sanitize on the backend as well!
 *
 * Strategy:
 * 1. Escape HTML entities to prevent XSS attacks
 * 2. Remove suspicious characters and patterns
 * 3. Validate input format (email, phone, numbers, etc.)
 */

/**
 * Escape HTML entities to prevent XSS
 * Converts special characters to HTML entities
 * @param {string} text - Raw user input
 * @returns {string} - Safely escaped text
 */
export function escapeHtml(text) {
  if (!text) return ''
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
  }
  return String(text).replace(/[&<>"'/]/g, char => map[char])
}

/**
 * Remove any HTML tags from input
 * @param {string} text - Input with potential HTML
 * @returns {string} - Text with all HTML tags removed
 */
export function stripHtmlTags(text) {
  if (!text) return ''
  return String(text).replace(/<[^>]*>/g, '')
}

/**
 * Validate and sanitize email
 * @param {string} email - Email input
 * @returns {boolean} - True if valid email format
 */
export function sanitizeEmail(email) {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(String(email).toLowerCase())
}

/**
 * Sanitize phone number - remove all non-digits
 * @param {string} phone - Phone input
 * @returns {string} - Digits only
 */
export function sanitizePhoneNumber(phone) {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '').slice(0, 20) // Max 20 digits
}

/**
 * Validate and sanitize numeric input
 * @param {string|number} value - Numeric input
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number|null} - Parsed number or null if invalid
 */
export function sanitizeNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseFloat(value)
  if (!isNaN(num) && num >= min && num <= max) {
    return num
  }
  return null
}

/**
 * Sanitize text input - remove suspicious characters
 * @param {string} text - Text input
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized text
 */
export function sanitizeText(text, maxLength = 255) {
  if (!text) return ''

  // Remove HTML tags
  let sanitized = stripHtmlTags(text)

  // Trim whitespace
  sanitized = sanitized.trim()

  // Limit length
  sanitized = sanitized.slice(0, maxLength)

  return sanitized
}

/**
 * Sanitize name input
 * @param {string} name - Name input
 * @returns {string} - Sanitized name
 */
export function sanitizeName(name) {
  if (!name) return ''
  // Keep only letters, spaces, hyphens, apostrophes
  return String(name)
    .replace(/[^a-zA-Z\s'-]/g, '')
    .trim()
    .slice(0, 100)
}

/**
 * Sanitize student ID
 * @param {string} studentId - Student ID input
 * @returns {string} - Sanitized ID or empty string if invalid
 */
export function sanitizeStudentId(studentId) {
  if (!studentId) return ''
  // Keep alphanumeric and common separators
  const sanitized = String(studentId)
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
    .slice(0, 20)
  return sanitized
}

/**
 * Validate OTP input
 * @param {string} otp - OTP value
 * @returns {boolean} - True if valid (4-6 digits)
 */
export function validateOTP(otp) {
  if (!otp) return false
  const sanitized = String(otp).replace(/\D/g, '')
  return sanitized.length >= 4 && sanitized.length <= 6
}

/**
 * Sanitize amount input (for payments)
 * @param {string|number} amount - Amount value
 * @returns {number|null} - Valid amount or null
 */
export function sanitizeAmount(amount) {
  const num = parseFloat(amount)
  if (isNaN(num) || num <= 0 || num > 1000000) {
    return null
  }
  // Round to 2 decimal places
  return Math.round(num * 100) / 100
}

/**
 * Create a Content Security Policy violation reporter
 * This helps detect XSS attempts in production
 */
export function setupSecurityReporting(endpoint = '/api/security/csp-report') {
  // Report CSP violations to server
  if (typeof window !== 'undefined') {
    window.addEventListener('securitypolicyviolation', e => {
      // Send CSP violation to backend for security monitoring
      navigator.sendBeacon(
        endpoint,
        JSON.stringify({
          'violated-directive': e.violatedDirective,
          'blocked-uri': e.blockedURI,
          'original-policy': e.originalPolicy,
          'source-file': e.sourceFile,
          'line-number': e.lineNumber,
        })
      )
    })
  }
}

export default {
  escapeHtml,
  stripHtmlTags,
  sanitizeEmail,
  sanitizePhoneNumber,
  sanitizeNumber,
  sanitizeText,
  sanitizeName,
  sanitizeStudentId,
  validateOTP,
  sanitizeAmount,
  setupSecurityReporting,
}
