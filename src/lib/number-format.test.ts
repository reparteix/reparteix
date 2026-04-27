import { describe, expect, it } from 'vitest'

import { formatDecimalInput, formatMoney, formatPercent, parseLocaleNumber } from './number-format'

describe('number-format', () => {
  it('formats money with ca-ES locale by default', () => {
    expect(formatMoney(12.5, 'EUR')).toBe('12,50 €')
  })

  it('formats percentages with locale decimals', () => {
    expect(formatPercent(0.125, 1)).toBe('12,5 %')
  })

  it('parses localized decimal inputs', () => {
    expect(parseLocaleNumber('12,5')).toBe(12.5)
    expect(parseLocaleNumber(' 1 234,56 € ')).toBe(1234.56)
  })

  it('formats numbers back for decimal inputs', () => {
    expect(formatDecimalInput(12.5)).toBe('12,5')
  })
})
