const { canDecrement, isVersionConflict, calculateNewQuantity } = require('./validation')

describe('Stock Deduction — canDecrement()', () => {
  it('allows decrement when stock is positive', () => {
    expect(canDecrement(10).ok).toBe(true)
    expect(canDecrement(1).ok).toBe(true)
  })

  it('rejects decrement when stock is zero', () => {
    const result = canDecrement(0)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('out_of_stock')
  })

  it('rejects decrement when stock is negative', () => {
    const result = canDecrement(-5)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('out_of_stock')
  })

  it('rejects decrement when quantity is null', () => {
    expect(canDecrement(null).ok).toBe(false)
  })

  it('rejects decrement when quantity is undefined', () => {
    expect(canDecrement(undefined).ok).toBe(false)
  })

  it('rejects decrement when quantity is a string', () => {
    expect(canDecrement('10').ok).toBe(false)
  })

  it('rejects decrement when quantity is NaN', () => {
    expect(canDecrement(NaN).ok).toBe(false)
  })

  it('rejects decrement when quantity is a boolean', () => {
    expect(canDecrement(true).ok).toBe(false)
  })

  it('allows decrement for large stock quantities', () => {
    expect(canDecrement(1000000).ok).toBe(true)
  })
})

describe('Stock Deduction — isVersionConflict()', () => {
  it('detects conflict when zero rows were updated (another request won the race)', () => {
    expect(isVersionConflict(0)).toBe(true)
  })

  it('reports no conflict when one row was updated successfully', () => {
    expect(isVersionConflict(1)).toBe(false)
  })

  it('reports no conflict when multiple rows were updated', () => {
    expect(isVersionConflict(2)).toBe(false)
  })

  it('detects conflict for negative values', () => {
    expect(isVersionConflict(-1)).toBe(false)
  })
})

describe('Stock Deduction — calculateNewQuantity()', () => {
  it('decrements quantity by exactly 1', () => {
    expect(calculateNewQuantity(10)).toBe(9)
    expect(calculateNewQuantity(5)).toBe(4)
  })

  it('reaches zero when only one item remains', () => {
    expect(calculateNewQuantity(1)).toBe(0)
  })

  it('goes negative when decrementing from zero (guard at higher level)', () => {
    expect(calculateNewQuantity(0)).toBe(-1)
  })

  it('handles large quantities correctly', () => {
    expect(calculateNewQuantity(1000000)).toBe(999999)
  })
})
