/**
 * Pure validation functions for notification-hub.
 * Extracted for unit testing without Socket.IO dependencies.
 */

/**
 * Validates a notify request body (POST /notify).
 * @param {object} body
 * @returns {{ valid: boolean, error?: string }}
 */
function validateNotifyRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object.' }
  }
  if (!body.orderId || typeof body.orderId !== 'string' || body.orderId.trim().length === 0) {
    return { valid: false, error: 'orderId is required and must be a non-empty string.' }
  }
  if (!body.status || typeof body.status !== 'string' || body.status.trim().length === 0) {
    return { valid: false, error: 'status is required and must be a non-empty string.' }
  }
  return { valid: true }
}

/**
 * Validates a join-order socket event payload.
 * @param {object} payload
 * @returns {{ valid: boolean, error?: string }}
 */
function validateJoinOrder(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object.' }
  }
  if (
    !payload.orderId ||
    typeof payload.orderId !== 'string' ||
    payload.orderId.trim().length === 0
  ) {
    return { valid: false, error: 'orderId is required.' }
  }
  return { valid: true }
}

/**
 * Validates a join-student socket event payload.
 * @param {object} payload
 * @returns {{ valid: boolean, error?: string }}
 */
function validateJoinStudent(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object.' }
  }
  if (
    !payload.studentId ||
    typeof payload.studentId !== 'string' ||
    payload.studentId.trim().length === 0
  ) {
    return { valid: false, error: 'studentId is required.' }
  }
  return { valid: true }
}

/**
 * Builds the notification payload emitted via Socket.IO.
 * @param {string} orderId
 * @param {string} status
 * @param {object} orderInfo
 * @returns {object}
 */
function buildNotificationPayload(orderId, status, orderInfo = {}) {
  return {
    orderId,
    status,
    orderInfo,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Formats the student-specific room name.
 * @param {string} studentId
 * @returns {string}
 */
function getStudentRoom(studentId) {
  return `student-${studentId}`
}

module.exports = {
  validateNotifyRequest,
  validateJoinOrder,
  validateJoinStudent,
  buildNotificationPayload,
  getStudentRoom,
}
