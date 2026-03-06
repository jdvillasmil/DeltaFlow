import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { toVes } from '@/lib/rates/refresh-rates'

describe('decimal.js arithmetic correctness', () => {
  it('0.1 + 0.2 equals 0.3 (not 0.30000000000000004)', () => {
    const result = new Decimal('0.1').plus(new Decimal('0.2'))
    expect(result.toFixed(8)).toBe('0.30000000')
    // Prove native JS fails
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('toVes(100, 36.50) returns 3650.00000000', () => {
    expect(toVes('100', '36.50')).toBe('3650.00000000')
  })

  it('toVes handles crypto precision (8 decimal places)', () => {
    // 0.00001 BTC at rate 1000000 VES/BTC = 10 VES
    expect(toVes('0.00001', '1000000')).toBe('10.00000000')
  })

  it('toVes handles large VES nominal values without overflow', () => {
    // VES can have large values due to inflation history
    const result = toVes('999999.99999999', '99999.99999999')
    const d = new Decimal(result)
    expect(d.isFinite()).toBe(true)
    expect(d.isNaN()).toBe(false)
  })
})
