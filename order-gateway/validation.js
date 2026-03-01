/**
 * Pure validation functions for order request logic.
 * Extracted for unit testing without DB/auth dependencies.
 */

/**
 * Validates an incoming order request body.
 * @param {object} body - Request body from POST /orders
 * @returns {{ valid: boolean, error?: string }}
 */
function validateOrderRequest(body = {}) {
  if (!body.itemId) {
    return { valid: false, error: 'itemId is required.' }
  }
  if (typeof body.itemId !== 'number' || !Number.isInteger(body.itemId) || body.itemId <= 0) {
    return { valid: false, error: 'itemId must be a positive integer.' }
  }
  return { valid: true }
}

/**
 * Checks if a student has enough wallet balance to place an order.
 * @param {number} balance - Current wallet balance in BDT
 * @param {number} price   - Item price in BDT
 * @returns {{ ok: boolean, error?: string }}
 */
function validateBalance(balance, price) {
  if (typeof balance !== 'number' || typeof price !== 'number' || isNaN(balance) || isNaN(price)) {
    return { ok: false, error: 'Invalid balance or price.' }
  }
  if (balance < price) {
    return {
      ok: false,
      error: `Insufficient balance. You have ৳${balance.toFixed(2)} but need ৳${price.toFixed(2)}.`,
    }
  }
  return { ok: true }
}

/**
 * Validates an idempotency key format.
 * @param {string} key - The X-Idempotency-Key header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateIdempotencyKey(key) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    return { valid: false, error: 'Idempotency key must be a non-empty string.' }
  }
  if (key.length > 100) {
    return { valid: false, error: 'Idempotency key must be 100 characters or fewer.' }
  }
  return { valid: true }
}

module.exports = { validateOrderRequest, validateBalance, validateIdempotencyKey }
