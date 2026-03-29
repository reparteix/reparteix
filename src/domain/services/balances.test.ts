import { describe, it, expect } from 'vitest'
import {
  calculateBalances,
  calculateSettlements,
} from './balances'
import type { Expense, Payment } from '../entities'

function makeExpense(
  overrides: Partial<Expense> & Pick<Expense, 'amount' | 'payerId' | 'splitAmong'>,
): Expense {
  return {
    id: crypto.randomUUID(),
    groupId: 'g1',
    description: 'Test',
    date: '2024-01-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    ...overrides,
  }
}

function makePayment(
  overrides: Partial<Payment> & Pick<Payment, 'fromId' | 'toId' | 'amount'>,
): Payment {
  return {
    id: crypto.randomUUID(),
    groupId: 'g1',
    date: '2024-01-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    ...overrides,
  }
}

describe('calculateBalances', () => {
  it('returns zero balances with no expenses', () => {
    const balances = calculateBalances(['a', 'b', 'c'], [], [])
    expect(balances).toEqual([
      { memberId: 'a', total: 0 },
      { memberId: 'b', total: 0 },
      { memberId: 'c', total: 0 },
    ])
  })

  it('calculates correct balances for a simple expense split equally', () => {
    const expenses = [
      makeExpense({ amount: 30, payerId: 'a', splitAmong: ['a', 'b', 'c'] }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])

    // a paid 30, owes 10 → net +20
    // b paid 0, owes 10 → net -10
    // c paid 0, owes 10 → net -10
    expect(balances.find((b) => b.memberId === 'a')?.total).toBe(20)
    expect(balances.find((b) => b.memberId === 'b')?.total).toBe(-10)
    expect(balances.find((b) => b.memberId === 'c')?.total).toBe(-10)
  })

  it('handles multiple expenses', () => {
    const expenses = [
      makeExpense({ amount: 30, payerId: 'a', splitAmong: ['a', 'b', 'c'] }),
      makeExpense({ amount: 60, payerId: 'b', splitAmong: ['a', 'b', 'c'] }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])

    // a: +30 -10 +0 -20 = 0 → net 0 (paid 30, owes 30)
    // wait: expense1: a gets +30 (paid), a -10, b -10, c -10
    // expense2: b gets +60 (paid), a -20, b -20, c -20
    // a: +30 -10 -20 = 0
    // b: -10 +60 -20 = 30
    // c: -10 -20 = -30
    expect(balances.find((b) => b.memberId === 'a')?.total).toBe(0)
    expect(balances.find((b) => b.memberId === 'b')?.total).toBe(30)
    expect(balances.find((b) => b.memberId === 'c')?.total).toBe(-30)
  })

  it('ignores deleted expenses', () => {
    const expenses = [
      makeExpense({
        amount: 30,
        payerId: 'a',
        splitAmong: ['a', 'b', 'c'],
        deleted: true,
      }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])
    expect(balances.every((b) => b.total === 0)).toBe(true)
  })

  it('handles partial splits (not all members)', () => {
    const expenses = [
      makeExpense({ amount: 20, payerId: 'a', splitAmong: ['a', 'b'] }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])

    // a paid 20, owes 10 → net +10
    // b paid 0, owes 10 → net -10
    // c not involved → 0
    expect(balances.find((b) => b.memberId === 'a')?.total).toBe(10)
    expect(balances.find((b) => b.memberId === 'b')?.total).toBe(-10)
    expect(balances.find((b) => b.memberId === 'c')?.total).toBe(0)
  })

  it('accounts for payments', () => {
    const expenses = [
      makeExpense({ amount: 30, payerId: 'a', splitAmong: ['a', 'b', 'c'] }),
    ]
    const payments = [
      makePayment({ fromId: 'b', toId: 'a', amount: 10 }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, payments)

    // Without payment: a=+20, b=-10, c=-10
    // Payment b→a (10): b gets +10, a gets -10
    // a: 20 - 10 = 10
    // b: -10 + 10 = 0
    // c: -10
    expect(balances.find((b) => b.memberId === 'a')?.total).toBe(10)
    expect(balances.find((b) => b.memberId === 'b')?.total).toBe(0)
    expect(balances.find((b) => b.memberId === 'c')?.total).toBe(-10)
  })

  it('balances sum to zero', () => {
    const expenses = [
      makeExpense({ amount: 33.33, payerId: 'a', splitAmong: ['a', 'b', 'c'] }),
      makeExpense({ amount: 50, payerId: 'b', splitAmong: ['a', 'c'] }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])
    const sum = balances.reduce((s, b) => s + b.total, 0)
    expect(Math.abs(sum)).toBeLessThan(0.02)
  })

  it('calculates correct balances for a proportional split (2:1:1)', () => {
    // a pays €40, split proportionally: a=2, b=1, c=1 → a owes €20, b owes €10, c owes €10
    const expenses = [
      makeExpense({
        amount: 40,
        payerId: 'a',
        splitAmong: ['a', 'b', 'c'],
        splitType: 'proportional',
        splitProportions: { a: 2, b: 1, c: 1 },
      }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])

    // a paid 40, owes 20 (half) → net +20
    // b paid 0, owes 10 (quarter) → net -10
    // c paid 0, owes 10 (quarter) → net -10
    expect(balances.find((b) => b.memberId === 'a')?.total).toBe(20)
    expect(balances.find((b) => b.memberId === 'b')?.total).toBe(-10)
    expect(balances.find((b) => b.memberId === 'c')?.total).toBe(-10)
  })

  it('proportional split with unequal weights', () => {
    // b pays €30, split proportionally: a=1, b=2 → a owes €10, b owes €20
    const expenses = [
      makeExpense({
        amount: 30,
        payerId: 'b',
        splitAmong: ['a', 'b'],
        splitType: 'proportional',
        splitProportions: { a: 1, b: 2 },
      }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])

    // b paid 30, owes 20 → net +10
    // a paid 0, owes 10 → net -10
    // c not involved → 0
    expect(balances.find((b) => b.memberId === 'a')?.total).toBe(-10)
    expect(balances.find((b) => b.memberId === 'b')?.total).toBe(10)
    expect(balances.find((b) => b.memberId === 'c')?.total).toBe(0)
  })

  it('proportional balances sum to zero', () => {
    const expenses = [
      makeExpense({
        amount: 100,
        payerId: 'a',
        splitAmong: ['a', 'b', 'c'],
        splitType: 'proportional',
        splitProportions: { a: 3, b: 2, c: 1 },
      }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])
    const sum = balances.reduce((s, b) => s + b.total, 0)
    expect(Math.abs(sum)).toBeLessThan(0.02)
  })

  it('falls back to equal split when splitType is proportional but splitProportions is missing', () => {
    const expenses = [
      makeExpense({
        amount: 30,
        payerId: 'a',
        splitAmong: ['a', 'b', 'c'],
        splitType: 'proportional',
        // splitProportions intentionally omitted
      }),
    ]
    const balances = calculateBalances(['a', 'b', 'c'], expenses, [])

    // Should fall back to equal split: each owes 10
    expect(balances.find((b) => b.memberId === 'a')?.total).toBe(20)
    expect(balances.find((b) => b.memberId === 'b')?.total).toBe(-10)
    expect(balances.find((b) => b.memberId === 'c')?.total).toBe(-10)
  })
})

describe('calculateSettlements', () => {
  it('returns no settlements when all balanced', () => {
    const settlements = calculateSettlements([
      { memberId: 'a', total: 0 },
      { memberId: 'b', total: 0 },
    ])
    expect(settlements).toEqual([])
  })

  it('calculates simple settlement between two people', () => {
    const settlements = calculateSettlements([
      { memberId: 'a', total: 10 },
      { memberId: 'b', total: -10 },
    ])
    expect(settlements).toHaveLength(1)
    expect(settlements[0]).toEqual({
      fromId: 'b',
      toId: 'a',
      amount: 10,
    })
  })

  it('minimizes number of transfers for 3 people', () => {
    const settlements = calculateSettlements([
      { memberId: 'a', total: 20 },
      { memberId: 'b', total: -10 },
      { memberId: 'c', total: -10 },
    ])
    expect(settlements).toHaveLength(2)
    const totalPaidToA = settlements
      .filter((s) => s.toId === 'a')
      .reduce((sum, s) => sum + s.amount, 0)
    expect(totalPaidToA).toBe(20)
  })

  it('handles complex settlements', () => {
    const settlements = calculateSettlements([
      { memberId: 'a', total: 30 },
      { memberId: 'b', total: -10 },
      { memberId: 'c', total: -20 },
    ])
    // Total owed to a: 30, from b (10) and c (20)
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0)
    expect(totalSettled).toBe(30)
  })

  it('settlement amounts sum correctly', () => {
    const settlements = calculateSettlements([
      { memberId: 'a', total: 15 },
      { memberId: 'b', total: 5 },
      { memberId: 'c', total: -12 },
      { memberId: 'd', total: -8 },
    ])

    // Verify conservation: total from = total to
    const totalFrom = settlements.reduce((s, t) => s + t.amount, 0)
    expect(totalFrom).toBe(20)
  })
})
