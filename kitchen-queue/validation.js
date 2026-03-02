/**
 * Pure validation functions for kitchen-queue.
 * Extracted for unit testing without DB/RabbitMQ dependencies.
 */

/**
 * Validates an order message from the RabbitMQ queue.
 * @param {object} order
 * @returns {{ valid: boolean, error?: string }}
 */
function validateOrderMessage(order) {
  if (!order || typeof order !== 'object') {
    return { valid: false, error: 'Order message must be an object.' }
  }
  if (!order.orderId || typeof order.orderId !== 'string') {
    return { valid: false, error: 'orderId is required and must be a string.' }
  }
  if (!order.studentId || typeof order.studentId !== 'string') {
    return { valid: false, error: 'studentId is required and must be a string.' }
  }
  if (!order.itemName || typeof order.itemName !== 'string') {
    return { valid: false, error: 'itemName is required and must be a string.' }
  }
  return { valid: true }
}

/**
 * Calculates a random preparation time within the configured range.
 * @param {number} minMs - Minimum cooking time in ms
 * @param {number} maxMs - Maximum cooking time in ms
 * @returns {number} Prep time in ms
 */
function calculatePrepTime(minMs, maxMs) {
  if (typeof minMs !== 'number' || typeof maxMs !== 'number' || isNaN(minMs) || isNaN(maxMs)) {
    return 5000 // default fallback
  }
  if (minMs < 0) minMs = 0
  if (maxMs < minMs) maxMs = minMs
  return minMs + Math.random() * (maxMs - minMs)
}

/**
 * Validates a notify request payload.
 * @param {object} payload
 * @returns {{ valid: boolean, error?: string }}
 */
function validateNotifyPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object.' }
  }
  if (!payload.orderId || typeof payload.orderId !== 'string') {
    return { valid: false, error: 'orderId is required.' }
  }
  if (!payload.status || typeof payload.status !== 'string') {
    return { valid: false, error: 'status is required.' }
  }
  const validStatuses = ['PENDING', 'STOCK_VERIFIED', 'IN_KITCHEN', 'READY', 'FAILED']
  if (!validStatuses.includes(payload.status)) {
    return { valid: false, error: `status must be one of: ${validStatuses.join(', ')}` }
  }
  return { valid: true }
}

/**
 * Determines the order status transition sequence validity.
 * @param {string} current
 * @param {string} next
 * @returns {boolean}
 */
function isValidStatusTransition(current, next) {
  const transitions = {
    PENDING: ['STOCK_VERIFIED', 'IN_KITCHEN', 'FAILED'],
    STOCK_VERIFIED: ['IN_KITCHEN', 'FAILED'],
    IN_KITCHEN: ['READY', 'FAILED'],
    READY: [],
    FAILED: [],
  }
  return (transitions[current] || []).includes(next)
}

module.exports = {
  validateOrderMessage,
  calculatePrepTime,
  validateNotifyPayload,
  isValidStatusTransition,
}
