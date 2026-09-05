import type { Expense, Payment } from '../entities'
import { calculateBalances } from './balances'

export interface GroupSummaryLeader {
  memberId: string
  value: number
}

export interface GroupExecutiveSummary {
  totalExpenses: number
  expenseCount: number
  paymentCount: number
  averageExpense: number
  firstExpenseDate: string | null
  lastExpenseDate: string | null
  outstandingBalanceTotal: number
  topPayerByAmount: GroupSummaryLeader | null
  topPayerByCount: GroupSummaryLeader | null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateGroupExecutiveSummary(
  groupId: string,
  memberIds: string[],
  expenses: Expense[],
  payments: Payment[],
): GroupExecutiveSummary {
  const activeExpenses = expenses.filter(
    (expense) => expense.groupId === groupId && !expense.deleted,
  )
  const activePayments = payments.filter(
    (payment) => payment.groupId === groupId && !payment.deleted,
  )

  const totalExpenses = roundMoney(
    activeExpenses.reduce((sum, expense) => sum + expense.amount, 0),
  )

  const averageExpense = activeExpenses.length > 0
    ? roundMoney(totalExpenses / activeExpenses.length)
    : 0

  const sortedExpenseDates = activeExpenses
    .map((expense) => expense.date)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))

  const balances = calculateBalances(memberIds, activeExpenses, activePayments)
  const outstandingBalanceTotal = roundMoney(
    balances
      .filter((balance) => balance.total > 0.01)
      .reduce((sum, balance) => sum + balance.total, 0),
  )

  const paidAmountByMember = new Map<string, number>()
  const paidCountByMember = new Map<string, number>()

  for (const expense of activeExpenses) {
    paidAmountByMember.set(
      expense.payerId,
      roundMoney((paidAmountByMember.get(expense.payerId) ?? 0) + expense.amount),
    )
    paidCountByMember.set(expense.payerId, (paidCountByMember.get(expense.payerId) ?? 0) + 1)
  }

  const topPayerByAmount = getTopLeader(paidAmountByMember)
  const topPayerByCount = getTopLeader(paidCountByMember)

  return {
    totalExpenses,
    expenseCount: activeExpenses.length,
    paymentCount: activePayments.length,
    averageExpense,
    firstExpenseDate: sortedExpenseDates[0] ?? null,
    lastExpenseDate: sortedExpenseDates.at(-1) ?? null,
    outstandingBalanceTotal,
    topPayerByAmount,
    topPayerByCount,
  }
}

function getTopLeader(values: Map<string, number>): GroupSummaryLeader | null {
  let leader: GroupSummaryLeader | null = null

  for (const [memberId, value] of values.entries()) {
    if (!leader || value > leader.value) {
      leader = { memberId, value }
    }
  }

  return leader
}
