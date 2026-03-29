import type { Expense, Payment } from '../entities'

export interface Balance {
  memberId: string
  total: number
}

export interface Settlement {
  fromId: string
  toId: string
  amount: number
}

/**
 * Calculate the net balance for each member.
 * Positive = is owed money (creditor), Negative = owes money (debtor).
 */
export function calculateBalances(
  memberIds: string[],
  expenses: Expense[],
  payments: Payment[],
): Balance[] {
  const balanceMap = new Map<string, number>()

  for (const id of memberIds) {
    balanceMap.set(id, 0)
  }

  for (const expense of expenses) {
    if (expense.deleted) continue

    // Payer paid for everyone, so they are owed
    balanceMap.set(
      expense.payerId,
      (balanceMap.get(expense.payerId) ?? 0) + expense.amount,
    )

    // Each person who benefited owes their share
    if (expense.splitType === 'proportional' && expense.splitProportions) {
      const totalWeight = expense.splitAmong.reduce(
        (sum, id) => sum + (expense.splitProportions?.[id] ?? 1),
        0,
      )
      for (const memberId of expense.splitAmong) {
        const weight = expense.splitProportions?.[memberId] ?? 1
        const share = totalWeight > 0 ? expense.amount * (weight / totalWeight) : 0
        balanceMap.set(memberId, (balanceMap.get(memberId) ?? 0) - share)
      }
    } else {
      const sharePerPerson = expense.amount / expense.splitAmong.length
      for (const memberId of expense.splitAmong) {
        balanceMap.set(
          memberId,
          (balanceMap.get(memberId) ?? 0) - sharePerPerson,
        )
      }
    }
  }

  // Payments: from pays to
  for (const payment of payments) {
    if (payment.deleted) continue
    balanceMap.set(
      payment.fromId,
      (balanceMap.get(payment.fromId) ?? 0) + payment.amount,
    )
    balanceMap.set(
      payment.toId,
      (balanceMap.get(payment.toId) ?? 0) - payment.amount,
    )
  }

  return memberIds.map((id) => ({
    memberId: id,
    total: Math.round((balanceMap.get(id) ?? 0) * 100) / 100,
  }))
}

/**
 * Minimize settlements using greedy matching.
 * Returns a list of transfers that settle all debts.
 */
export function calculateSettlements(balances: Balance[]): Settlement[] {
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const b of balances) {
    if (b.total > 0.01) {
      creditors.push({ id: b.memberId, amount: b.total })
    } else if (b.total < -0.01) {
      debtors.push({ id: b.memberId, amount: -b.total })
    }
  }

  // Sort descending by amount for greedy matching
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amount, debtors[j].amount)
    if (amount > 0.01) {
      settlements.push({
        fromId: debtors[j].id,
        toId: creditors[i].id,
        amount: Math.round(amount * 100) / 100,
      })
    }
    creditors[i].amount -= amount
    debtors[j].amount -= amount

    if (creditors[i].amount < 0.01) i++
    if (debtors[j].amount < 0.01) j++
  }

  return settlements
}
