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
 * Uses integer-cent arithmetic with a two-pass matrix allocation
 * to guarantee exact conservation on both debtor and creditor sides.
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

  const totalCreditCents = Math.round(
    creditors.reduce((sum, c) => sum + c.amount, 0) * 100,
  )
  const creditorCents = creditors.map((c) => Math.round(c.amount * 100))
  const debtorCents = debtors.map((d) => Math.round(d.amount * 100))
  const lastD = debtors.length - 1
  const lastC = creditors.length - 1

  // matrix[i][j] = cents debtor i pays creditor j
  const matrix: number[][] = Array.from({ length: debtors.length }, () =>
    new Array(creditors.length).fill(0),
  )

  // Pass 1: fill all rows except the last debtor
  for (let i = 0; i < lastD; i++) {
    let rowSum = 0
    for (let j = 0; j < lastC; j++) {
      matrix[i][j] = Math.floor(
        (debtorCents[i] * creditorCents[j]) / totalCreditCents,
      )
      rowSum += matrix[i][j]
    }
    // Last creditor gets remainder to ensure row sum = debtorCents[i]
    matrix[i][lastC] = debtorCents[i] - rowSum
  }

  // Pass 2: last debtor gets column remainders to ensure column sums match
  for (let j = 0; j <= lastC; j++) {
    let colSum = 0
    for (let i = 0; i < lastD; i++) {
      colSum += matrix[i][j]
    }
    matrix[lastD][j] = creditorCents[j] - colSum
  }

  // Convert to settlements, skipping zero-cent entries
  const settlements: Settlement[] = []
  for (let i = 0; i < debtors.length; i++) {
    for (let j = 0; j < creditors.length; j++) {
      if (matrix[i][j] >= 1) {
        settlements.push({
          fromId: debtors[i].id,
          toId: creditors[j].id,
          amount: matrix[i][j] / 100,
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
  const savedTransfers = Math.max(0, naiveCount - minimizedCount)
  const reductionPercent =
    naiveCount > 0
      ? Math.min(100, Math.max(0, round2((savedTransfers / naiveCount) * 100)))
      : 0

  return {
    naive,
    minimized,
    naiveCount,
    minimizedCount,
    savedTransfers,
    reductionPercent,
  }
}
