/**
 * Pure validation functions for stock deduction logic.
 * Extracted for unit testing without DB/Redis dependencies.
 */

/**
 * Checks whether stock can be decremented.
 * @param {number} quantity - Current stock quantity
 * @returns {{ ok: boolean, reason?: string }}
 */
function canDecrement(quantity) {
  if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
    return { ok: false, reason: 'out_of_stock' }
  }
  return { ok: true }
}

/**
 * Determines if an optimistic lock conflict occurred.
 * @param {number} updatedRowCount - Rows affected by the UPDATE query
 * @returns {boolean}
 */
function isVersionConflict(updatedRowCount) {
  return updatedRowCount === 0
}

/**
 * Calculates the new quantity after a single decrement.
 * @param {number} quantity
 * @returns {number}
 */
function calculateNewQuantity(quantity) {
  return quantity - 1
}

module.exports = { canDecrement, isVersionConflict, calculateNewQuantity }
