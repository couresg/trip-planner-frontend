import { describe, expect, it } from 'vitest'
import { formatCurrency } from './format'

describe('formatCurrency', () => {
  it('formats KRW without decimals', () => {
    expect(formatCurrency(12000, 'KRW')).toBe('₩12,000')
  })

  it('formats JPY', () => {
    expect(formatCurrency(1500, 'JPY')).toMatch(/1,500/)
    expect(formatCurrency(1500, 'JPY', 'ja-JP')).toMatch(/1,500/)
  })
})
