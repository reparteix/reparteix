import { describe, expect, it } from 'vitest'
import { calculateGroupExecutiveSummary } from './reporting'
import type { Expense, Payment } from '../entities'

const members = ['anna', 'bert', 'clara']

const expenses: Expense[] = [
  {
    id: 'e1',
    groupId: 'g1',
    description: 'Sopar',
    amount: 60,
    payerId: 'anna',
    splitAmong: members,
    date: '2026-04-10',
    createdAt: '2026-04-10T10:00:00.000Z',
    updatedAt: '2026-04-10T10:00:00.000Z',
    deleted: false,
    archived: false,
  },
  {
    id: 'e2',
    groupId: 'g1',
    description: 'Taxi',
    amount: 30,
    payerId: 'bert',
    splitAmong: ['anna', 'bert'],
    date: '2026-04-11',
    createdAt: '2026-04-11T10:00:00.000Z',
    updatedAt: '2026-04-11T10:00:00.000Z',
    deleted: false,
    archived: false,
  },
  {
    id: 'e3',
    groupId: 'g1',
    description: 'Deleted expense',
    amount: 999,
    payerId: 'clara',
    splitAmong: ['clara'],
    date: '2026-04-12',
    createdAt: '2026-04-12T10:00:00.000Z',
    updatedAt: '2026-04-12T10:00:00.000Z',
    deleted: true,
    archived: false,
  },
  {
    id: 'e4',
    groupId: 'g2',
    description: 'Altre grup',
    amount: 500,
    payerId: 'clara',
    splitAmong: ['clara'],
    date: '2026-04-14',
    createdAt: '2026-04-14T10:00:00.000Z',
    updatedAt: '2026-04-14T10:00:00.000Z',
    deleted: false,
    archived: false,
  },
]

const payments: Payment[] = [
  {
    id: 'p1',
    groupId: 'g1',
    fromId: 'clara',
    toId: 'anna',
    amount: 20,
    date: '2026-04-12',
    createdAt: '2026-04-12T10:00:00.000Z',
    updatedAt: '2026-04-12T10:00:00.000Z',
    deleted: false,
  },
  {
    id: 'p2',
    groupId: 'g1',
    fromId: 'anna',
    toId: 'bert',
    amount: 5,
    date: '2026-04-13',
    createdAt: '2026-04-13T10:00:00.000Z',
    updatedAt: '2026-04-13T10:00:00.000Z',
    deleted: true,
  },
  {
    id: 'p3',
    groupId: 'g2',
    fromId: 'clara',
    toId: 'anna',
    amount: 999,
    date: '2026-04-14',
    createdAt: '2026-04-14T10:00:00.000Z',
    updatedAt: '2026-04-14T10:00:00.000Z',
    deleted: false,
  },
]

describe('calculateGroupExecutiveSummary', () => {
  it('builds the executive summary from active expenses and payments', () => {
    const summary = calculateGroupExecutiveSummary('g1', members, expenses, payments)

    expect(summary).toMatchObject({
      totalExpenses: 90,
      expenseCount: 2,
      paymentCount: 1,
      averageExpense: 45,
      firstExpenseDate: '2026-04-10',
      lastExpenseDate: '2026-04-11',
      outstandingBalanceTotal: 5,
      topPayerByAmount: {
        memberId: 'anna',
        value: 60,
      },
      topPayerByCount: {
        memberId: 'anna',
        value: 1,
      },
    })
  })

  it('returns a safe empty summary with no data', () => {
    const summary = calculateGroupExecutiveSummary('g1', [], [], [])

    expect(summary).toEqual({
      totalExpenses: 0,
      expenseCount: 0,
      paymentCount: 0,
      averageExpense: 0,
      firstExpenseDate: null,
      lastExpenseDate: null,
      outstandingBalanceTotal: 0,
      topPayerByAmount: null,
      topPayerByCount: null,
    })
  })
})
