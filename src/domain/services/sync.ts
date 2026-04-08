import type { Group, Member, Expense, Payment, SyncEnvelopeV1 } from '../entities'

export type SyncReport = {
  created: { groups: number; expenses: number; payments: number; members: number }
  updated: { groups: number; expenses: number; payments: number; members: number }
  skipped: { expenses: number; payments: number; members: number }
  rejected: Array<{ entity: string; id?: string; reason: string }>
  conflicts: Array<{ entity: string; id: string; reason: string }>
}

type GroupMergeAction = 'create' | 'update' | 'skip' | 'conflict'
type EntityAction = 'create' | 'update' | 'skip' | 'conflict' | 'reject'

export type MemberMergeItem = {
  member: Member
  action: Exclude<EntityAction, 'reject'>
}

export type ExpenseMergeItem = {
  expense: Expense
  action: EntityAction
  reason?: string
}

export type PaymentMergeItem = {
  payment: Payment
  action: EntityAction
  reason?: string
}

export type SyncMergeDecision = {
  groupAction: GroupMergeAction
  /** The group object to persist (winning metadata + merged members). */
  mergedGroup: Group
  members: MemberMergeItem[]
  expenses: ExpenseMergeItem[]
  payments: PaymentMergeItem[]
  report: SyncReport
}

/** Canonical JSON serialisation that sorts object keys recursively, making comparison field-order-independent.
 * This is needed because Zod's `.parse()` may reorder object keys to match the schema definition order,
 * while values retrieved from Dexie preserve the original insertion order.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort())
      : v,
  )
}

/** Return group fields excluding `members`, for comparison purposes. */
function groupMeta(g: Group): Omit<Group, 'members'> {
  const { id, name, description, icon, currency, archived, createdAt, updatedAt, deleted } = g
  return { id, name, description, icon, currency, archived, createdAt, updatedAt, deleted }
}

/** Return an error string if the expense fails referential integrity, or null if OK. */
function checkExpenseIntegrity(expense: Expense, memberIds: Set<string>): string | null {
  if (!memberIds.has(expense.payerId)) {
    return `payerId "${expense.payerId}" not found in group members`
  }
  for (const id of expense.splitAmong) {
    if (!memberIds.has(id)) {
      return `splitAmong member "${id}" not found in group members`
    }
  }
  return null
}

/** Return an error string if the payment fails referential integrity, or null if OK. */
function checkPaymentIntegrity(payment: Payment, memberIds: Set<string>): string | null {
  if (!memberIds.has(payment.fromId)) {
    return `fromId "${payment.fromId}" not found in group members`
  }
  if (!memberIds.has(payment.toId)) {
    return `toId "${payment.toId}" not found in group members`
  }
  return null
}

/**
 * Compute merge decisions (LWW + conflict detection + integrity checks) without any side effects.
 * Returns a SyncMergeDecision that can be applied to the DB or used as a preview.
 */
export function computeSyncMerge(
  envelope: SyncEnvelopeV1,
  localGroup: Group | undefined,
  localExpenses: Expense[],
  localPayments: Payment[],
): SyncMergeDecision {
  const report: SyncReport = {
    created: { groups: 0, expenses: 0, payments: 0, members: 0 },
    updated: { groups: 0, expenses: 0, payments: 0, members: 0 },
    skipped: { expenses: 0, payments: 0, members: 0 },
    rejected: [],
    conflicts: [],
  }

  // ─── Group metadata merge (LWW) ────────────────────────────────────
  let groupAction: GroupMergeAction = 'create'

  if (!localGroup) {
    groupAction = 'create'
    report.created.groups++
  } else if (localGroup.updatedAt < envelope.group.updatedAt) {
    groupAction = 'update'
    report.updated.groups++
  } else if (localGroup.updatedAt > envelope.group.updatedAt) {
    groupAction = 'skip'
  } else {
    // Same timestamp — check for divergence (ignore members for this comparison)
    if (canonicalJson(groupMeta(localGroup)) !== canonicalJson(groupMeta(envelope.group))) {
      groupAction = 'conflict'
      report.conflicts.push({
        entity: 'group',
        id: envelope.group.id,
        reason: 'same_timestamp_divergence',
      })
    } else {
      groupAction = 'skip'
    }
  }

  // ─── Members merge (each member is LWW-independent) ───────────────
  const localMemberMap = new Map((localGroup?.members ?? []).map((m) => [m.id, m]))
  const memberItems: MemberMergeItem[] = []

  for (const remoteMember of envelope.group.members) {
    const local = localMemberMap.get(remoteMember.id)
    if (!local) {
      memberItems.push({ member: remoteMember, action: 'create' })
      report.created.members++
      localMemberMap.set(remoteMember.id, remoteMember)
    } else if (local.updatedAt < remoteMember.updatedAt) {
      memberItems.push({ member: remoteMember, action: 'update' })
      report.updated.members++
      localMemberMap.set(remoteMember.id, remoteMember)
    } else if (local.updatedAt > remoteMember.updatedAt) {
      memberItems.push({ member: local, action: 'skip' })
      report.skipped.members++
    } else {
      // Same timestamp
      if (canonicalJson(local) !== canonicalJson(remoteMember)) {
        memberItems.push({ member: local, action: 'conflict' })
        report.conflicts.push({
          entity: 'member',
          id: remoteMember.id,
          reason: 'same_timestamp_divergence',
        })
      } else {
        memberItems.push({ member: local, action: 'skip' })
        report.skipped.members++
      }
    }
  }

  // Keep local-only members (not present in the remote snapshot) unchanged
  for (const [id, m] of localMemberMap) {
    if (!envelope.group.members.some((rm) => rm.id === id)) {
      memberItems.push({ member: m, action: 'skip' })
      // local-only — not counted in skipped report (not a remote item)
    }
  }

  // Build the merged member map used for the persisted group and integrity checks
  const mergedMembersMap = new Map<string, Member>()
  for (const item of memberItems) {
    mergedMembersMap.set(item.member.id, item.member)
  }

  // The group metadata comes from the LWW winner; members are always merged
  const winningGroupBase =
    groupAction === 'skip' || groupAction === 'conflict' ? localGroup! : envelope.group
  const mergedGroup: Group = {
    ...winningGroupBase,
    members: Array.from(mergedMembersMap.values()),
  }

  // ─── Build member ID set for integrity checks ──────────────────────
  const allMemberIds = new Set(mergedGroup.members.map((m) => m.id))

  // ─── Expenses merge (LWW + integrity) ─────────────────────────────
  const localExpenseMap = new Map(localExpenses.map((e) => [e.id, e]))
  const expenseItems: ExpenseMergeItem[] = []

  for (const remoteExpense of envelope.expenses) {
    // Integrity: groupId
    if (remoteExpense.groupId !== envelope.group.id) {
      const reason = `groupId "${remoteExpense.groupId}" does not match synced group "${envelope.group.id}"`
      report.rejected.push({ entity: 'expense', id: remoteExpense.id, reason })
      expenseItems.push({ expense: remoteExpense, action: 'reject', reason })
      continue
    }
    // Integrity: referential members
    const integrityError = checkExpenseIntegrity(remoteExpense, allMemberIds)
    if (integrityError) {
      report.rejected.push({ entity: 'expense', id: remoteExpense.id, reason: integrityError })
      expenseItems.push({ expense: remoteExpense, action: 'reject', reason: integrityError })
      continue
    }

    const local = localExpenseMap.get(remoteExpense.id)
    if (!local) {
      expenseItems.push({ expense: remoteExpense, action: 'create' })
      report.created.expenses++
    } else if (local.updatedAt < remoteExpense.updatedAt) {
      expenseItems.push({ expense: remoteExpense, action: 'update' })
      report.updated.expenses++
    } else if (local.updatedAt > remoteExpense.updatedAt) {
      expenseItems.push({ expense: remoteExpense, action: 'skip' })
      report.skipped.expenses++
    } else {
      // Same timestamp
      if (canonicalJson(local) !== canonicalJson(remoteExpense)) {
        expenseItems.push({ expense: local, action: 'conflict' })
        report.conflicts.push({
          entity: 'expense',
          id: remoteExpense.id,
          reason: 'same_timestamp_divergence',
        })
      } else {
        expenseItems.push({ expense: remoteExpense, action: 'skip' })
        report.skipped.expenses++
      }
    }
  }

  // ─── Payments merge (LWW + integrity) ─────────────────────────────
  const localPaymentMap = new Map(localPayments.map((p) => [p.id, p]))
  const paymentItems: PaymentMergeItem[] = []

  for (const remotePayment of envelope.payments) {
    // Integrity: groupId
    if (remotePayment.groupId !== envelope.group.id) {
      const reason = `groupId "${remotePayment.groupId}" does not match synced group "${envelope.group.id}"`
      report.rejected.push({ entity: 'payment', id: remotePayment.id, reason })
      paymentItems.push({ payment: remotePayment, action: 'reject', reason })
      continue
    }
    // Integrity: referential members
    const integrityError = checkPaymentIntegrity(remotePayment, allMemberIds)
    if (integrityError) {
      report.rejected.push({ entity: 'payment', id: remotePayment.id, reason: integrityError })
      paymentItems.push({ payment: remotePayment, action: 'reject', reason: integrityError })
      continue
    }

    const local = localPaymentMap.get(remotePayment.id)
    if (!local) {
      paymentItems.push({ payment: remotePayment, action: 'create' })
      report.created.payments++
    } else if (local.updatedAt < remotePayment.updatedAt) {
      paymentItems.push({ payment: remotePayment, action: 'update' })
      report.updated.payments++
    } else if (local.updatedAt > remotePayment.updatedAt) {
      paymentItems.push({ payment: remotePayment, action: 'skip' })
      report.skipped.payments++
    } else {
      // Same timestamp
      if (canonicalJson(local) !== canonicalJson(remotePayment)) {
        paymentItems.push({ payment: local, action: 'conflict' })
        report.conflicts.push({
          entity: 'payment',
          id: remotePayment.id,
          reason: 'same_timestamp_divergence',
        })
      } else {
        paymentItems.push({ payment: remotePayment, action: 'skip' })
        report.skipped.payments++
      }
    }
  }

  return {
    groupAction,
    mergedGroup,
    members: memberItems,
    expenses: expenseItems,
    payments: paymentItems,
    report,
  }
}
