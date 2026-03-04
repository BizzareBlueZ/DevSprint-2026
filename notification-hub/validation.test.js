const {
  validateNotifyRequest,
  validateJoinOrder,
  validateJoinStudent,
  buildNotificationPayload,
  getStudentRoom,
} = require('./validation')

// ─── POST /notify Validation ───────────────────────────────────

describe('Notification Hub — validateNotifyRequest()', () => {
  it('accepts valid payload with orderId and status', () => {
    expect(validateNotifyRequest({ orderId: 'abc-123', status: 'READY' }).valid).toBe(true)
  })

  it('accepts payload with extra fields', () => {
    expect(
      validateNotifyRequest({
        orderId: 'abc-123',
        status: 'READY',
        orderInfo: { itemName: 'Biryani' },
      }).valid
    ).toBe(true)
  })

  it('rejects null body', () => {
    expect(validateNotifyRequest(null).valid).toBe(false)
  })

  it('rejects undefined body', () => {
    expect(validateNotifyRequest(undefined).valid).toBe(false)
  })

  it('rejects non-object body', () => {
    expect(validateNotifyRequest('string').valid).toBe(false)
    expect(validateNotifyRequest(123).valid).toBe(false)
  })

  it('rejects missing orderId', () => {
    const result = validateNotifyRequest({ status: 'READY' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/orderId/)
  })

  it('rejects missing status', () => {
    const result = validateNotifyRequest({ orderId: 'abc-123' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/status/)
  })

  it('rejects empty orderId', () => {
    expect(validateNotifyRequest({ orderId: '', status: 'READY' }).valid).toBe(false)
  })

  it('rejects empty status', () => {
    expect(validateNotifyRequest({ orderId: 'abc-123', status: '' }).valid).toBe(false)
  })

  it('rejects whitespace-only orderId', () => {
    expect(validateNotifyRequest({ orderId: '   ', status: 'READY' }).valid).toBe(false)
  })

  it('rejects whitespace-only status', () => {
    expect(validateNotifyRequest({ orderId: 'abc-123', status: '   ' }).valid).toBe(false)
  })

  it('rejects non-string orderId', () => {
    expect(validateNotifyRequest({ orderId: 123, status: 'READY' }).valid).toBe(false)
  })

  it('rejects non-string status', () => {
    expect(validateNotifyRequest({ orderId: 'abc', status: 200 }).valid).toBe(false)
  })

  it('rejects empty object', () => {
    expect(validateNotifyRequest({}).valid).toBe(false)
  })
})

// ─── join-order Validation ─────────────────────────────────────

describe('Notification Hub — validateJoinOrder()', () => {
  it('accepts valid orderId', () => {
    expect(validateJoinOrder({ orderId: 'abc-123' }).valid).toBe(true)
  })

  it('rejects null', () => {
    expect(validateJoinOrder(null).valid).toBe(false)
  })

  it('rejects missing orderId', () => {
    expect(validateJoinOrder({}).valid).toBe(false)
  })

  it('rejects empty orderId', () => {
    expect(validateJoinOrder({ orderId: '' }).valid).toBe(false)
  })

  it('rejects whitespace-only orderId', () => {
    expect(validateJoinOrder({ orderId: '   ' }).valid).toBe(false)
  })

  it('rejects non-string orderId', () => {
    expect(validateJoinOrder({ orderId: 123 }).valid).toBe(false)
  })
})

// ─── join-student Validation ───────────────────────────────────

describe('Notification Hub — validateJoinStudent()', () => {
  it('accepts valid studentId', () => {
    expect(validateJoinStudent({ studentId: '230042135' }).valid).toBe(true)
  })

  it('rejects null', () => {
    expect(validateJoinStudent(null).valid).toBe(false)
  })

  it('rejects missing studentId', () => {
    expect(validateJoinStudent({}).valid).toBe(false)
  })

  it('rejects empty studentId', () => {
    expect(validateJoinStudent({ studentId: '' }).valid).toBe(false)
  })

  it('rejects whitespace-only studentId', () => {
    expect(validateJoinStudent({ studentId: '   ' }).valid).toBe(false)
  })

  it('rejects non-string studentId', () => {
    expect(validateJoinStudent({ studentId: 230042135 }).valid).toBe(false)
  })
})

// ─── Notification Payload Builder ──────────────────────────────

describe('Notification Hub — buildNotificationPayload()', () => {
  it('builds payload with correct fields', () => {
    const payload = buildNotificationPayload('abc-123', 'READY', { itemName: 'Biryani' })
    expect(payload.orderId).toBe('abc-123')
    expect(payload.status).toBe('READY')
    expect(payload.orderInfo).toEqual({ itemName: 'Biryani' })
    expect(payload.timestamp).toBeDefined()
  })

  it('includes ISO timestamp', () => {
    const payload = buildNotificationPayload('abc-123', 'READY')
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('defaults orderInfo to empty object', () => {
    const payload = buildNotificationPayload('abc-123', 'READY')
    expect(payload.orderInfo).toEqual({})
  })

  it('preserves all orderInfo fields', () => {
    const info = { itemName: 'Haleem', price: 80 }
    const payload = buildNotificationPayload('x', 'IN_KITCHEN', info)
    expect(payload.orderInfo.itemName).toBe('Haleem')
    expect(payload.orderInfo.price).toBe(80)
  })
})

// ─── Student Room Naming ───────────────────────────────────────

describe('Notification Hub — getStudentRoom()', () => {
  it('returns prefixed room name', () => {
    expect(getStudentRoom('230042135')).toBe('student-230042135')
  })

  it('handles different student IDs', () => {
    expect(getStudentRoom('220041001')).toBe('student-220041001')
    expect(getStudentRoom('240041003')).toBe('student-240041003')
  })

  it('handles edge case IDs', () => {
    expect(getStudentRoom('')).toBe('student-')
    expect(getStudentRoom('a')).toBe('student-a')
  })
})
