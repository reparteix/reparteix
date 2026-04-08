import { describe, it, expect } from 'vitest'
import {
  naiveSettlements,
  calculateNetting,
} from './netting'
import { calculateSettlements } from './balances'
import type { Balance } from './balances'

describe('naiveSettlements', () => {
  it('returns empty list when all balances are zero', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 0 },
      { memberId: 'b', total: 0 },
      { memberId: 'c', total: 0 },
    ]
    expect(naiveSettlements(balances)).toEqual([])
  })

  it('returns single transfer for two members', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 10 },
      { memberId: 'b', total: -10 },
    ]
    const result = naiveSettlements(balances)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ fromId: 'b', toId: 'a', amount: 10 })
  })

  it('creates O(debtors × creditors) transfers for cross debts', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 20 },
      { memberId: 'b', total: 10 },
      { memberId: 'c', total: -15 },
      { memberId: 'd', total: -15 },
    ]
    const result = naiveSettlements(balances)
    // 2 debtors × 2 creditors = 4 transfers
    expect(result).toHaveLength(4)
  })

  it('conserves total amounts (sum of transfers equals total debt)', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 30 },
      { memberId: 'b', total: 10 },
      { memberId: 'c', total: -25 },
      { memberId: 'd', total: -15 },
    ]
    const result = naiveSettlements(balances)
    const totalTransferred = result.reduce((sum, s) => sum + s.amount, 0)
    expect(totalTransferred).toBeCloseTo(40, 1)
  })

  it('each creditor receives their full amount', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 20 },
      { memberId: 'b', total: 10 },
      { memberId: 'c', total: -15 },
      { memberId: 'd', total: -15 },
    ]
    const result = naiveSettlements(balances)
    const receivedByA = result
      .filter((s) => s.toId === 'a')
      .reduce((sum, s) => sum + s.amount, 0)
    const receivedByB = result
      .filter((s) => s.toId === 'b')
      .reduce((sum, s) => sum + s.amount, 0)
    expect(receivedByA).toBeCloseTo(20, 1)
    expect(receivedByB).toBeCloseTo(10, 1)
  })

  it('handles single debtor, multiple creditors', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 15 },
      { memberId: 'b', total: 5 },
      { memberId: 'c', total: -20 },
    ]
    const result = naiveSettlements(balances)
    // 1 debtor × 2 creditors = 2 transfers
    expect(result).toHaveLength(2)
    const toA = result.find((s) => s.toId === 'a')
    const toB = result.find((s) => s.toId === 'b')
    expect(toA?.amount).toBeCloseTo(15, 1)
    expect(toB?.amount).toBeCloseTo(5, 1)
  })

  it('conserves totals with small decimal balances (regression)', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 0.03 },
      { memberId: 'b', total: 0.27 },
      { memberId: 'c', total: -0.15 },
      { memberId: 'd', total: -0.15 },
    ]
    const result = naiveSettlements(balances)

    // a must receive its 0.03 — no creditor should be skipped
    const receivedByA = result
      .filter((s) => s.toId === 'a')
      .reduce((sum, s) => sum + s.amount, 0)
    const receivedByB = result
      .filter((s) => s.toId === 'b')
      .reduce((sum, s) => sum + s.amount, 0)
    expect(receivedByA).toBeCloseTo(0.03, 2)
    expect(receivedByB).toBeCloseTo(0.27, 2)

    // Verify all balances settle to ~0
    const netMap = new Map<string, number>()
    for (const b of balances) netMap.set(b.memberId, b.total)
    for (const s of result) {
      netMap.set(s.fromId, (netMap.get(s.fromId) ?? 0) + s.amount)
      netMap.set(s.toId, (netMap.get(s.toId) ?? 0) - s.amount)
    }
    for (const [, net] of netMap) {
      expect(Math.abs(net)).toBeLessThan(0.02)
    }
  })
})

describe('minimizeSettlements (via calculateSettlements)', () => {
  it('returns empty list when all balances are zero', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 0 },
      { memberId: 'b', total: 0 },
    ]
    expect(calculateSettlements(balances)).toEqual([])
  })

  it('returns single transfer for two members', () => {
    const result = calculateSettlements([
      { memberId: 'a', total: 10 },
      { memberId: 'b', total: -10 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ fromId: 'b', toId: 'a', amount: 10 })
  })

  it('minimizes 3-person settlements to 2 transfers', () => {
    const result = calculateSettlements([
      { memberId: 'a', total: 20 },
      { memberId: 'b', total: -10 },
      { memberId: 'c', total: -10 },
    ])
    expect(result).toHaveLength(2)
  })

  it('handles complex 4-person case with fewer transfers than naive', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 30 },
      { memberId: 'b', total: 10 },
      { memberId: 'c', total: -25 },
      { memberId: 'd', total: -15 },
    ]
    const result = calculateSettlements(balances)
    // Greedy: at most n-1 = 3 transfers (typically fewer)
    expect(result.length).toBeLessThanOrEqual(3)

    // Verify conservation
    const total = result.reduce((sum, s) => sum + s.amount, 0)
    expect(total).toBeCloseTo(40, 1)
  })

  it('conserves total amounts exactly', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 15 },
      { memberId: 'b', total: 5 },
      { memberId: 'c', total: -12 },
      { memberId: 'd', total: -8 },
    ]
    const result = calculateSettlements(balances)
    const total = result.reduce((sum, s) => sum + s.amount, 0)
    expect(total).toBeCloseTo(20, 1)
  })

  it('settles all balances to zero', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 30 },
      { memberId: 'b', total: -10 },
      { memberId: 'c', total: -20 },
    ]
    const result = calculateSettlements(balances)

    // Verify each member's net is zero after settlements
    const netMap = new Map<string, number>()
    for (const b of balances) netMap.set(b.memberId, b.total)
    for (const s of result) {
      netMap.set(s.fromId, (netMap.get(s.fromId) ?? 0) + s.amount)
      netMap.set(s.toId, (netMap.get(s.toId) ?? 0) - s.amount)
    }
    for (const [, net] of netMap) {
      expect(Math.abs(net)).toBeLessThan(0.02)
    }
  })

  it('handles decimal amounts without drift > 0.01', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 33.33 },
      { memberId: 'b', total: -16.67 },
      { memberId: 'c', total: -16.66 },
    ]
    const result = calculateSettlements(balances)
    const total = result.reduce((sum, s) => sum + s.amount, 0)
    expect(Math.abs(total - 33.33)).toBeLessThan(0.02)
  })
})

describe('calculateNetting', () => {
  it('returns empty results when all balanced', () => {
    const result = calculateNetting([
      { memberId: 'a', total: 0 },
      { memberId: 'b', total: 0 },
      { memberId: 'c', total: 0 },
    ])
    expect(result.naive).toEqual([])
    expect(result.minimized).toEqual([])
    expect(result.naiveCount).toBe(0)
    expect(result.minimizedCount).toBe(0)
    expect(result.savedTransfers).toBe(0)
    expect(result.reductionPercent).toBe(0)
  })

  it('shows no reduction for simple 2-person case', () => {
    const result = calculateNetting([
      { memberId: 'a', total: 10 },
      { memberId: 'b', total: -10 },
    ])
    expect(result.naiveCount).toBe(1)
    expect(result.minimizedCount).toBe(1)
    expect(result.savedTransfers).toBe(0)
    expect(result.reductionPercent).toBe(0)
  })

  it('shows reduction for 3+ members with cross debts', () => {
    const result = calculateNetting([
      { memberId: 'a', total: 20 },
      { memberId: 'b', total: 10 },
      { memberId: 'c', total: -15 },
      { memberId: 'd', total: -15 },
    ])
    // Naive: 2 debtors × 2 creditors = 4
    // Minimized: ≤ 3
    expect(result.naiveCount).toBe(4)
    expect(result.minimizedCount).toBeLessThanOrEqual(3)
    expect(result.savedTransfers).toBeGreaterThanOrEqual(1)
    expect(result.reductionPercent).toBeGreaterThan(0)
  })

  it('naive and minimized totals match', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 50 },
      { memberId: 'b', total: -20 },
      { memberId: 'c', total: -15 },
      { memberId: 'd', total: -15 },
    ]
    const result = calculateNetting(balances)

    const naiveTotal = result.naive.reduce((sum, s) => sum + s.amount, 0)
    const minimizedTotal = result.minimized.reduce((sum, s) => sum + s.amount, 0)
    expect(naiveTotal).toBeCloseTo(minimizedTotal, 0)
  })

  it('handles 5-member group (benchmark-like)', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 40 },
      { memberId: 'b', total: 20 },
      { memberId: 'c', total: -25 },
      { memberId: 'd', total: -20 },
      { memberId: 'e', total: -15 },
    ]
    const result = calculateNetting(balances)

    // Naive: 3 debtors × 2 creditors = 6
    expect(result.naiveCount).toBe(6)
    // Minimized: ≤ 4 (n-1 where n=5)
    expect(result.minimizedCount).toBeLessThanOrEqual(4)
    expect(result.savedTransfers).toBeGreaterThanOrEqual(2)

    // Both settle all debts
    const totalDebt = 25 + 20 + 15
    const naiveTotal = result.naive.reduce((sum, s) => sum + s.amount, 0)
    const minimizedTotal = result.minimized.reduce((sum, s) => sum + s.amount, 0)
    expect(naiveTotal).toBeCloseTo(totalDebt, 0)
    expect(minimizedTotal).toBeCloseTo(totalDebt, 0)
  })

  it('handles 10-member group', () => {
    const balances: Balance[] = [
      { memberId: 'm1', total: 50 },
      { memberId: 'm2', total: 30 },
      { memberId: 'm3', total: 20 },
      { memberId: 'm4', total: -15 },
      { memberId: 'm5', total: -20 },
      { memberId: 'm6', total: -25 },
      { memberId: 'm7', total: -10 },
      { memberId: 'm8', total: -10 },
      { memberId: 'm9', total: -10 },
      { memberId: 'm10', total: -10 },
    ]
    const result = calculateNetting(balances)

    // Naive: 7 debtors × 3 creditors = 21
    expect(result.naiveCount).toBe(21)
    // Minimized: ≤ 9 (n-1)
    expect(result.minimizedCount).toBeLessThanOrEqual(9)
    expect(result.reductionPercent).toBeGreaterThan(50)
  })

  it('handles 25-member group', () => {
    // 5 creditors, 20 debtors
    const balances: Balance[] = [
      { memberId: 'c1', total: 100 },
      { memberId: 'c2', total: 80 },
      { memberId: 'c3', total: 60 },
      { memberId: 'c4', total: 40 },
      { memberId: 'c5', total: 20 },
      ...Array.from({ length: 20 }, (_, i) => ({
        memberId: `d${i + 1}`,
        total: -15,
      })),
    ]
    const result = calculateNetting(balances)

    // Naive: 20 × 5 = 100
    expect(result.naiveCount).toBe(100)
    // Minimized: ≤ 24 (n-1)
    expect(result.minimizedCount).toBeLessThanOrEqual(24)
    expect(result.reductionPercent).toBeGreaterThan(70)

    // Conservation check
    const naiveTotal = result.naive.reduce((sum, s) => sum + s.amount, 0)
    const minimizedTotal = result.minimized.reduce((sum, s) => sum + s.amount, 0)
    expect(naiveTotal).toBeCloseTo(300, 0)
    expect(minimizedTotal).toBeCloseTo(300, 0)
  })

  it('minimized settlements settle all balances to zero', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 25 },
      { memberId: 'b', total: 15 },
      { memberId: 'c', total: -10 },
      { memberId: 'd', total: -20 },
      { memberId: 'e', total: -10 },
    ]
    const result = calculateNetting(balances)

    const netMap = new Map<string, number>()
    for (const b of balances) netMap.set(b.memberId, b.total)
    for (const s of result.minimized) {
      netMap.set(s.fromId, (netMap.get(s.fromId) ?? 0) + s.amount)
      netMap.set(s.toId, (netMap.get(s.toId) ?? 0) - s.amount)
    }
    for (const [, net] of netMap) {
      expect(Math.abs(net)).toBeLessThan(0.02)
    }
  })

  it('naive settlements settle all balances to zero', () => {
    const balances: Balance[] = [
      { memberId: 'a', total: 25 },
      { memberId: 'b', total: 15 },
      { memberId: 'c', total: -10 },
      { memberId: 'd', total: -20 },
      { memberId: 'e', total: -10 },
    ]
    const result = calculateNetting(balances)

    const netMap = new Map<string, number>()
    for (const b of balances) netMap.set(b.memberId, b.total)
    for (const s of result.naive) {
      netMap.set(s.fromId, (netMap.get(s.fromId) ?? 0) + s.amount)
      netMap.set(s.toId, (netMap.get(s.toId) ?? 0) - s.amount)
    }
    for (const [, net] of netMap) {
      expect(Math.abs(net)).toBeLessThan(0.02)
    }
  })

  it('handles single member with zero balance', () => {
    const result = calculateNetting([{ memberId: 'a', total: 0 }])
    expect(result.naiveCount).toBe(0)
    expect(result.minimizedCount).toBe(0)
  })

  it('handles near-zero balances within epsilon', () => {
    const result = calculateNetting([
      { memberId: 'a', total: 0.005 },
      { memberId: 'b', total: -0.005 },
    ])
    expect(result.naiveCount).toBe(0)
    expect(result.minimizedCount).toBe(0)
  })
})
