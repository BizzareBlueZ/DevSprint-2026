const { validateOrderRequest, validateBalance, validateIdempotencyKey } = require('./validation')

describe('Order Validation — validateOrderRequest()', () => {
  it('accepts a valid order with itemId', () => {
    expect(validateOrderRequest({ itemId: 1, type: 'dinner' }).valid).toBe(true)
  })

  it('accepts order with only itemId present', () => {
    expect(validateOrderRequest({ itemId: 3 }).valid).toBe(true)
  })

  it('rejects order when itemId is missing', () => {
    const result = validateOrderRequest({ type: 'dinner' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/itemId/i)
  })

  it('rejects order when itemId is null', () => {
    const result = validateOrderRequest({ itemId: null })
    expect(result.valid).toBe(false)
  })

  it('rejects order when itemId is undefined', () => {
    const result = validateOrderRequest({ itemId: undefined })
    expect(result.valid).toBe(false)
  })

  it('rejects an empty body', () => {
    expect(validateOrderRequest({}).valid).toBe(false)
  })

  it('rejects when no body is provided', () => {
    expect(validateOrderRequest().valid).toBe(false)
  })

  it('rejects when itemId is a string', () => {
    expect(validateOrderRequest({ itemId: '3' }).valid).toBe(false)
  })

  it('rejects when itemId is zero', () => {
    expect(validateOrderRequest({ itemId: 0 }).valid).toBe(false)
  })

  it('rejects when itemId is negative', () => {
    expect(validateOrderRequest({ itemId: -1 }).valid).toBe(false)
  })

  it('rejects when itemId is a float', () => {
    expect(validateOrderRequest({ itemId: 1.5 }).valid).toBe(false)
  })
})

describe('Order Validation — validateBalance()', () => {
  it('approves order when balance is greater than price', () => {
    expect(validateBalance(500, 120).ok).toBe(true)
  })

  it('approves order when balance exactly equals price', () => {
    expect(validateBalance(120, 120).ok).toBe(true)
  })

  it('rejects order when balance is less than price', () => {
    const result = validateBalance(50, 120)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/insufficient/i)
  })

  it('rejects order when balance is zero', () => {
    expect(validateBalance(0, 120).ok).toBe(false)
  })

  it('rejects order when balance is negative', () => {
    expect(validateBalance(-10, 120).ok).toBe(false)
  })

  it('rejects when balance is not a number', () => {
    expect(validateBalance('500', 120).ok).toBe(false)
  })

  it('rejects when price is not a number', () => {
    expect(validateBalance(500, '120').ok).toBe(false)
  })

  it('error message includes the actual amounts', () => {
    const result = validateBalance(50.00, 120.00)
    expect(result.error).toContain('50.00')
    expect(result.error).toContain('120.00')
  })

  it('handles decimal precision correctly', () => {
    expect(validateBalance(120.01, 120.00).ok).toBe(true)
    expect(validateBalance(119.99, 120.00).ok).toBe(false)
  })

  it('rejects NaN values', () => {
    expect(validateBalance(NaN, 120).ok).toBe(false)
    expect(validateBalance(500, NaN).ok).toBe(false)
  })
})

describe('Idempotency — validateIdempotencyKey()', () => {
  it('accepts a valid UUID-style key', () => {
    expect(validateIdempotencyKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890').valid).toBe(true)
  })

  it('accepts a short alphanumeric key', () => {
    expect(validateIdempotencyKey('order-123').valid).toBe(true)
  })

  it('rejects an empty string', () => {
    const result = validateIdempotencyKey('')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/non-empty/i)
  })

  it('rejects a whitespace-only string', () => {
    expect(validateIdempotencyKey('   ').valid).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(validateIdempotencyKey(123).valid).toBe(false)
    expect(validateIdempotencyKey(null).valid).toBe(false)
    expect(validateIdempotencyKey(undefined).valid).toBe(false)
  })

  it('rejects keys longer than 100 characters', () => {
    const longKey = 'a'.repeat(101)
    const result = validateIdempotencyKey(longKey)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/100/i)
  })

  it('accepts a key exactly 100 characters long', () => {
    expect(validateIdempotencyKey('a'.repeat(100)).valid).toBe(true)
  })
})
