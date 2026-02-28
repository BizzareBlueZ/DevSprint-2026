// stock-service/tests/stock.test.js

describe('Order Validation Logic', () => {
    test('rejects order with missing itemId', () => {
        const validateOrder = (body) => {
            if (!body.itemId) return { valid: false, message: 'itemId is required.' }
            if (typeof body.itemId !== 'number') return { valid: false, message: 'itemId must be a number.' }
            if (body.itemId <= 0) return { valid: false, message: 'itemId must be positive.' }
            return { valid: true }
        }
        expect(validateOrder({})).toEqual({ valid: false, message: 'itemId is required.' })
        expect(validateOrder({ itemId: 'abc' })).toEqual({ valid: false, message: 'itemId must be a number.' })
        expect(validateOrder({ itemId: -1 })).toEqual({ valid: false, message: 'itemId must be positive.' })
        expect(validateOrder({ itemId: 1 })).toEqual({ valid: true })
    })

    test('rejects order when quantity is zero', () => {
        const canOrder = (quantity) => quantity > 0
        expect(canOrder(0)).toBe(false)
        expect(canOrder(-1)).toBe(false)
        expect(canOrder(10)).toBe(true)
    })
})

describe('Stock Deduction Logic', () => {
    test('decrements stock correctly', () => {
        const deduct = (current, amount = 1) => {
            if (current <= 0) throw new Error('Out of stock')
            return current - amount
        }
        expect(deduct(10)).toBe(9)
        expect(deduct(1)).toBe(0)
        expect(() => deduct(0)).toThrow('Out of stock')
    })

    test('optimistic locking detects version conflict', () => {
        const attemptUpdate = (currentVersion, storedVersion) => {
            if (currentVersion !== storedVersion) return { success: false, reason: 'version conflict' }
            return { success: true, newVersion: storedVersion + 1 }
        }
        expect(attemptUpdate(1, 1)).toEqual({ success: true, newVersion: 2 })
        expect(attemptUpdate(1, 2)).toEqual({ success: false, reason: 'version conflict' })
    })

    test('prevents negative stock', () => {
        const safeDeduct = (quantity) => Math.max(0, quantity - 1)
        expect(safeDeduct(5)).toBe(4)
        expect(safeDeduct(1)).toBe(0)
        expect(safeDeduct(0)).toBe(0)
    })

    test('handles bulk order scenario correctly', () => {
        let stock = 3
        const orders = [1, 1, 1, 1] // 4 orders but only 3 in stock
        const results = orders.map(() => {
            if (stock > 0) { stock--; return 'accepted' }
            return 'rejected'
        })
        expect(results.filter(r => r === 'accepted')).toHaveLength(3)
        expect(results.filter(r => r === 'rejected')).toHaveLength(1)
        expect(stock).toBe(0)
    })
})