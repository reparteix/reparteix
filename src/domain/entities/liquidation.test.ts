import { describe, it, expect } from 'vitest'
import { LiquidationSchema } from './index'

describe('Liquidation entity', () => {
  it('validates a correct liquidation object', () => {
    const data = {
      id: 'liq-1',
      groupId: 'g-1',
      name: 'Tancament Març',
      periodStart: '2026-03-01T00:00:00.000Z',
      periodEnd: '2026-03-31T23:59:59.999Z',
      transfers: [
        { fromId: 'm-1', toId: 'm-2', amount: 50.5 }
      ],
      balances: {
        'm-1': -50.5,
        'm-2': 50.5
      },
      totalSpent: 200,
      createdAt: '2026-04-10T10:00:00.000Z'
    }

    const result = LiquidationSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid data (missing required fields)', () => {
    const data = {
      id: 'liq-1',
      groupId: 'g-1',
      // missing name
      transfers: [],
      balances: {},
      totalSpent: 0,
      createdAt: '2026-04-10T10:00:00.000Z'
    }

    const result = LiquidationSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
