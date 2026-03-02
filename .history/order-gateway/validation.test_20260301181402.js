const { validateOrderRequest, validateBalance } = require('./validation')

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
})
