import type { Balance } from './balances'
import { calculateSettlements, type Settlement } from './balances'

export interface NettingResult {
  /** Naive settlements: each debtor pays each creditor proportionally. */
  naive: Settlement[]
  /** Minimized settlements using greedy matching. */
  minimized: Settlement[]
  /** Number of naive transfers. */
  naiveCount: number
  /** Number of minimized transfers. */
  minimizedCount: number
  /** Absolute reduction in number of transfers. */
  savedTransfers: number
  /** Percentage reduction (0–100). */
  reductionPercent: number
}

const EPSILON = 0.01

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Generate naive settlements where each debtor pays each creditor
 * proportionally to their share of total credit.
 */
export function naiveSettlements(balances: Balance[]): Settlement[] {
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const b of balances) {
    if (b.total > EPSILON) {
      creditors.push({ id: b.memberId, amount: b.total })
    } else if (b.total < -EPSILON) {
      debtors.push({ id: b.memberId, amount: -b.total })
    }
  }

  if (creditors.length === 0 || debtors.length === 0) return []

  const totalCredit = creditors.reduce((sum, c) => sum + c.amount, 0)
  const settlements: Settlement[] = []

  for (const debtor of debtors) {
    for (const creditor of creditors) {
      const amount = round2(debtor.amount * (creditor.amount / totalCredit))
      if (amount > EPSILON) {
        settlements.push({
          fromId: debtor.id,
          toId: creditor.id,
          amount,
        })
      }
    }
  }

  return settlements
}

/**
 * Calculate netting result: compare naive vs minimized settlements.
 * Pure function — no side effects.
 */
export function calculateNetting(balances: Balance[]): NettingResult {
  const naive = naiveSettlements(balances)
  const minimized = calculateSettlements(balances)

  const naiveCount = naive.length
  const minimizedCount = minimized.length
  const savedTransfers = naiveCount - minimizedCount
  const reductionPercent =
    naiveCount > 0 ? round2((savedTransfers / naiveCount) * 100) : 0

  return {
    naive,
    minimized,
    naiveCount,
    minimizedCount,
    savedTransfers,
    reductionPercent,
  }
}
