const {
  validateOrderMessage,
  calculatePrepTime,
  validateNotifyPayload,
  isValidStatusTransition,
} = require('./validation')

// ─── Order Message Validation ──────────────────────────────────

describe('Kitchen Queue — validateOrderMessage()', () => {
  const validOrder = {
    orderId: 'abc-123',
    studentId: '230042135',
    itemName: 'Biryani',
  }

  it('accepts a valid order message', () => {
    expect(validateOrderMessage(validOrder).valid).toBe(true)
  })

  it('accepts order with extra fields', () => {
    expect(validateOrderMessage({ ...validOrder, itemId: 1, type: 'dinner' }).valid).toBe(true)
  })

  it('rejects null', () => {
    expect(validateOrderMessage(null).valid).toBe(false)
  })

  it('rejects undefined', () => {
    expect(validateOrderMessage(undefined).valid).toBe(false)
  })

  it('rejects a string', () => {
    expect(validateOrderMessage('not-an-object').valid).toBe(false)
  })

  it('rejects when orderId is missing', () => {
    const { orderId, ...rest } = validOrder
    const result = validateOrderMessage(rest)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/orderId/)
  })

  it('rejects when studentId is missing', () => {
    const { studentId, ...rest } = validOrder
    const result = validateOrderMessage(rest)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/studentId/)
  })

  it('rejects when itemName is missing', () => {
    const { itemName, ...rest } = validOrder
    const result = validateOrderMessage(rest)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/itemName/)
  })

  it('rejects when orderId is a number', () => {
    expect(validateOrderMessage({ ...validOrder, orderId: 123 }).valid).toBe(false)
  })

  it('rejects when studentId is a number', () => {
    expect(validateOrderMessage({ ...validOrder, studentId: 230042135 }).valid).toBe(false)
  })

  it('rejects empty object', () => {
    expect(validateOrderMessage({}).valid).toBe(false)
  })
})

// ─── Preparation Time ──────────────────────────────────────────

describe('Kitchen Queue — calculatePrepTime()', () => {
  it('returns a value between min and max', () => {
    for (let i = 0; i < 50; i++) {
      const time = calculatePrepTime(3000, 7000)
      expect(time).toBeGreaterThanOrEqual(3000)
      expect(time).toBeLessThanOrEqual(7000)
    }
  })

  it('returns exactly min when min equals max', () => {
    expect(calculatePrepTime(5000, 5000)).toBe(5000)
  })

  it('handles min > max by treating max = min', () => {
    const time = calculatePrepTime(7000, 3000)
    expect(time).toBe(7000)
  })

  it('returns default 5000 for non-numeric inputs', () => {
    expect(calculatePrepTime('fast', 'slow')).toBe(5000)
    expect(calculatePrepTime(null, null)).toBe(5000)
    expect(calculatePrepTime(NaN, NaN)).toBe(5000)
  })

  it('handles zero values', () => {
    const time = calculatePrepTime(0, 1000)
    expect(time).toBeGreaterThanOrEqual(0)
    expect(time).toBeLessThanOrEqual(1000)
  })

  it('clamps negative min to 0', () => {
    const time = calculatePrepTime(-1000, 5000)
    expect(time).toBeGreaterThanOrEqual(0)
    expect(time).toBeLessThanOrEqual(5000)
  })
})

// ─── Notify Payload ────────────────────────────────────────────

describe('Kitchen Queue — validateNotifyPayload()', () => {
  it('accepts valid READY payload', () => {
    expect(validateNotifyPayload({ orderId: 'abc-123', status: 'READY' }).valid).toBe(true)
  })

  it('accepts valid IN_KITCHEN payload', () => {
    expect(validateNotifyPayload({ orderId: 'abc-123', status: 'IN_KITCHEN' }).valid).toBe(true)
  })

  it('accepts all valid statuses', () => {
    const statuses = ['PENDING', 'STOCK_VERIFIED', 'IN_KITCHEN', 'READY', 'FAILED']
    statuses.forEach(status => {
      expect(validateNotifyPayload({ orderId: 'x', status }).valid).toBe(true)
    })
  })

  it('rejects null payload', () => {
    expect(validateNotifyPayload(null).valid).toBe(false)
  })

  it('rejects empty object', () => {
    expect(validateNotifyPayload({}).valid).toBe(false)
  })

  it('rejects missing orderId', () => {
    const result = validateNotifyPayload({ status: 'READY' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/orderId/)
  })

  it('rejects missing status', () => {
    const result = validateNotifyPayload({ orderId: 'abc-123' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/status/)
  })

  it('rejects invalid status value', () => {
    const result = validateNotifyPayload({ orderId: 'abc-123', status: 'COOKING' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/must be one of/)
  })

  it('rejects non-string status', () => {
    expect(validateNotifyPayload({ orderId: 'abc-123', status: 1 }).valid).toBe(false)
  })
})

// ─── Status Transitions ────────────────────────────────────────

describe('Kitchen Queue — isValidStatusTransition()', () => {
  it('allows PENDING → IN_KITCHEN', () => {
    expect(isValidStatusTransition('PENDING', 'IN_KITCHEN')).toBe(true)
  })

  it('allows PENDING → STOCK_VERIFIED', () => {
    expect(isValidStatusTransition('PENDING', 'STOCK_VERIFIED')).toBe(true)
  })

  it('allows STOCK_VERIFIED → IN_KITCHEN', () => {
    expect(isValidStatusTransition('STOCK_VERIFIED', 'IN_KITCHEN')).toBe(true)
  })

  it('allows IN_KITCHEN → READY', () => {
    expect(isValidStatusTransition('IN_KITCHEN', 'READY')).toBe(true)
  })

  it('allows any state → FAILED', () => {
    expect(isValidStatusTransition('PENDING', 'FAILED')).toBe(true)
    expect(isValidStatusTransition('STOCK_VERIFIED', 'FAILED')).toBe(true)
    expect(isValidStatusTransition('IN_KITCHEN', 'FAILED')).toBe(true)
  })

  it('disallows READY → any', () => {
    expect(isValidStatusTransition('READY', 'PENDING')).toBe(false)
    expect(isValidStatusTransition('READY', 'IN_KITCHEN')).toBe(false)
    expect(isValidStatusTransition('READY', 'FAILED')).toBe(false)
  })

  it('disallows FAILED → any', () => {
    expect(isValidStatusTransition('FAILED', 'PENDING')).toBe(false)
    expect(isValidStatusTransition('FAILED', 'READY')).toBe(false)
  })

  it('disallows backwards transitions', () => {
    expect(isValidStatusTransition('IN_KITCHEN', 'PENDING')).toBe(false)
    expect(isValidStatusTransition('READY', 'IN_KITCHEN')).toBe(false)
    expect(isValidStatusTransition('IN_KITCHEN', 'STOCK_VERIFIED')).toBe(false)
  })

  it('handles unknown current status', () => {
    expect(isValidStatusTransition('UNKNOWN', 'READY')).toBe(false)
  })
})
