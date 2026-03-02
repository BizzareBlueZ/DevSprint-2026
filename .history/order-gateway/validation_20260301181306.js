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
  return { valid: true }
}

/**
 * Checks if a student has enough wallet balance to place an order.
 * @param {number} balance - Current wallet balance in BDT
 * @param {number} price   - Item price in BDT
 * @returns {{ ok: boolean, error?: string }}
 */
function validateBalance(balance, price) {
  if (typeof balance !== 'number' || typeof price !== 'number') {
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

module.exports = { validateOrderRequest, validateBalance }
