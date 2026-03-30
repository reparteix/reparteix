import type { Group, Expense, Payment, Member, GroupExport, ReparteixExportV1, SyncEnvelopeV1 } from './domain/entities'
import { GroupExportSchema, ReparteixExportV1Schema, SyncEnvelopeV1Schema } from './domain/entities'
import {
  calculateBalances,
  calculateSettlements,
  computeSyncMerge,
  type Balance,
  type Settlement,
  type SyncReport,
} from './domain/services'
import { db } from './infra/db'

export type { Group, Expense, Payment, Member, Balance, Settlement, GroupExport, ReparteixExportV1, SyncEnvelopeV1, SyncReport }
export { calculateBalances, calculateSettlements }

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
]

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

/** Headless API for Reparteix — no React or UI dependencies. */
export const reparteix = {
  // ─── Groups ────────────────────────────────────────────────────────

  /** List all non-deleted groups. */
  async listGroups(): Promise<Group[]> {
    return db.groups.filter((g) => !g.deleted).toArray()
  },

  /** Get a single group by ID (returns undefined if not found or deleted). */
  async getGroup(id: string): Promise<Group | undefined> {
    const group = await db.groups.get(id)
    return group && !group.deleted ? group : undefined
  },

  /** Create a new group and return it. */
  async createGroup(name: string, currency = 'EUR'): Promise<Group> {
    const timestamp = now()
    const group: Group = {
      id: generateId(),
      name,
      currency,
      members: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.groups.add(group)
    return group
  },

  /** Update group metadata (name, description, icon, currency). */
  async updateGroup(
    id: string,
    updates: {
      name?: string
      description?: string
      icon?: string
      currency?: string
    },
  ): Promise<Group> {
    const group = await db.groups.get(id)
    if (!group) throw new Error(`Group not found: ${id}`)
    const patch: Partial<Group> = { ...updates, updatedAt: now() }
    await db.groups.update(id, patch)
    return { ...group, ...patch }
  },

  /** Soft-delete a group. */
  async deleteGroup(id: string): Promise<void> {
    const group = await db.groups.get(id)
    if (group) {
      await db.groups.update(id, { deleted: true, updatedAt: now() })
    }
  },

  // ─── Members ───────────────────────────────────────────────────────

  /** Add a member to a group and return it. */
  async addMember(groupId: string, name: string): Promise<Member> {
    const group = await db.groups.get(groupId)
    if (!group) throw new Error('Group not found')

    const timestamp = now()
    const member: Member = {
      id: generateId(),
      name,
      color: COLORS[group.members.length % COLORS.length],
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    const updatedMembers = [...group.members, member]
    await db.groups.update(groupId, {
      members: updatedMembers,
      updatedAt: timestamp,
    })
    return member
  },

  /** Soft-delete a member from a group. Throws if the member has any expenses or payments. */
  async removeMember(groupId: string, memberId: string): Promise<void> {
    const group = await db.groups.get(groupId)
    if (!group) return

    const expenseCount = await db.expenses
      .where('groupId')
      .equals(groupId)
      .filter(
        (e) =>
          !e.deleted &&
          (e.payerId === memberId || e.splitAmong.includes(memberId)),
      )
      .count()

    if (expenseCount > 0) {
      throw new Error('Cannot remove a member who has expenses')
    }

    const paymentCount = await db.payments
      .where('groupId')
      .equals(groupId)
      .filter(
        (p) => !p.deleted && (p.fromId === memberId || p.toId === memberId),
      )
      .count()

    if (paymentCount > 0) {
      throw new Error('Cannot remove a member who has payments')
    }

    const updatedMembers = group.members.map((m) =>
      m.id === memberId ? { ...m, deleted: true, updatedAt: now() } : m,
    )
    await db.groups.update(groupId, {
      members: updatedMembers,
      updatedAt: now(),
    })
  },

  /** Rename a member in a group. */
  async renameMember(
    groupId: string,
    memberId: string,
    newName: string,
  ): Promise<void> {
    const group = await db.groups.get(groupId)
    if (!group) throw new Error('Group not found')

    const member = group.members.find((m) => m.id === memberId)
    if (!member || member.deleted) throw new Error('Member not found')

    const updatedMembers = group.members.map((m) =>
      m.id === memberId ? { ...m, name: newName, updatedAt: now() } : m,
    )
    await db.groups.update(groupId, {
      members: updatedMembers,
      updatedAt: now(),
    })
  },

  // ─── Expenses ──────────────────────────────────────────────────────

  /** Return a map of groupId → total expense amount for all non-deleted expenses. */
  async listExpenseTotalsByGroup(): Promise<Record<string, number>> {
    const expenses = await db.expenses.filter((e) => !e.deleted).toArray()
    return expenses.reduce(
      (acc, e) => {
        acc[e.groupId] = (acc[e.groupId] ?? 0) + e.amount
        return acc
      },
      {} as Record<string, number>,
    )
  },

  /** List all non-deleted expenses for a group. */
  async listExpenses(groupId: string): Promise<Expense[]> {
    return db.expenses
      .where('groupId')
      .equals(groupId)
      .filter((e) => !e.deleted)
      .toArray()
  },

  /** Add an expense and return it. */
  async addExpense(
    expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>,
  ): Promise<Expense> {
    const timestamp = now()
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.expenses.add(newExpense)
    return newExpense
  },

  /** Update an existing expense. */
  async updateExpense(expense: Expense): Promise<Expense> {
    const updated = { ...expense, updatedAt: now() }
    await db.expenses.update(expense.id, updated)
    return updated
  },

  /** Soft-delete an expense. */
  async deleteExpense(id: string): Promise<void> {
    const expense = await db.expenses.get(id)
    if (expense) {
      await db.expenses.update(id, { deleted: true, updatedAt: now() })
    }
  },

  // ─── Payments ──────────────────────────────────────────────────────

  /** List all non-deleted payments for a group. */
  async listPayments(groupId: string): Promise<Payment[]> {
    return db.payments
      .where('groupId')
      .equals(groupId)
      .filter((p) => !p.deleted)
      .toArray()
  },

  /** Add a payment and return it. */
  async addPayment(
    payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>,
  ): Promise<Payment> {
    const timestamp = now()
    const newPayment: Payment = {
      ...payment,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.payments.add(newPayment)
    return newPayment
  },

  /** Soft-delete a payment. */
  async deletePayment(id: string): Promise<void> {
    const payment = await db.payments.get(id)
    if (payment) {
      await db.payments.update(id, { deleted: true, updatedAt: now() })
    }
  },

  // ─── Balances & Settlements ────────────────────────────────────────

  /** Calculate net balances for all active members in a group. */
  async getBalances(groupId: string): Promise<Balance[]> {
    const group = await db.groups.get(groupId)
    if (!group) return []

    const memberIds = group.members.filter((m) => !m.deleted).map((m) => m.id)
    const expenses = await reparteix.listExpenses(groupId)
    const payments = await reparteix.listPayments(groupId)

    return calculateBalances(memberIds, expenses, payments)
  },

  /** Calculate minimum settlements needed to clear all debts in a group. */
  async getSettlements(groupId: string): Promise<Settlement[]> {
    const balances = await reparteix.getBalances(groupId)
    return calculateSettlements(balances)
  },

  // ─── Import / Export ───────────────────────────────────────────────

  /** Export a group and all its data as a versioned JSON object (ReparteixExportV1 envelope). */
  async exportGroup(groupId: string): Promise<ReparteixExportV1> {
    const group = await db.groups.get(groupId)
    if (!group) throw new Error(`Group not found: ${groupId}`)

    const expenses = await db.expenses
      .where('groupId')
      .equals(groupId)
      .toArray()

    const payments = await db.payments
      .where('groupId')
      .equals(groupId)
      .toArray()

    return {
      format: 'reparteix-export',
      version: 1,
      exportedAt: now(),
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined,
      data: {
        groups: [group],
        expenses,
        payments,
      },
    }
  },

  /**
   * Import group(s) from a file object. Supports:
   * - ReparteixExportV1 envelope (format: 'reparteix-export', version: 1)
   * - Legacy GroupExport format (schemaVersion: 1)
   * Validates with Zod before any writes.
   * Uses Last-Write-Wins (by updatedAt) for ID collisions.
   * The entire operation runs inside a Dexie transaction — no partial mutations.
   * Returns the first imported group (all groups are persisted).
   */
  async importGroup(raw: unknown): Promise<Group> {
    // Normalise to canonical internal model
    let groups: Group[]
    let expenses: Expense[]
    let payments: Payment[]

    const obj = raw as Record<string, unknown> | null | undefined
    if (obj && obj.format === 'reparteix-export') {
      // ── New envelope format ────────────────────────────────────────
      const envelope = ReparteixExportV1Schema.parse(raw)
      groups = envelope.data.groups
      expenses = envelope.data.expenses
      payments = envelope.data.payments
    } else {
      // ── Legacy format fallback ─────────────────────────────────────
      const data = GroupExportSchema.parse(raw)
      groups = [data.group]
      expenses = data.expenses
      payments = data.payments
    }

    await db.transaction('rw', [db.groups, db.expenses, db.payments], async () => {
      // ── Groups ─────────────────────────────────────────────────────
      for (const group of groups) {
        const existingGroup = await db.groups.get(group.id)
        if (
          !existingGroup ||
          existingGroup.updatedAt < group.updatedAt ||
          (existingGroup.deleted && !group.deleted)
        ) {
          await db.groups.put(group)
        }
      }

      // ── Expenses ───────────────────────────────────────────────────
      for (const expense of expenses) {
        const existing = await db.expenses.get(expense.id)
        if (!existing || existing.updatedAt < expense.updatedAt) {
          await db.expenses.put(expense)
        }
      }

      // ── Payments ───────────────────────────────────────────────────
      for (const payment of payments) {
        const existing = await db.payments.get(payment.id)
        if (!existing || existing.updatedAt < payment.updatedAt) {
          await db.payments.put(payment)
        }
      }
    })

    const result = await db.groups.get(groups[0].id)
    if (!result) throw new Error('Import failed: group not found after write')
    return result
  },

  // ─── Sync ──────────────────────────────────────────────────────────

  sync: {
    /**
     * Apply an incoming sync envelope to the local database.
     * Validates with Zod, merges with LWW conflict resolution, checks referential integrity,
     * and persists all valid changes in a single Dexie transaction.
     * Returns a SyncReport summarising what was created, updated, skipped, conflicted or rejected.
     */
    async applyGroupJson(raw: unknown): Promise<SyncReport> {
      const envelope = SyncEnvelopeV1Schema.parse(raw)

      const localGroup = await db.groups.get(envelope.group.id)
      const localExpenses = localGroup
        ? await db.expenses.where('groupId').equals(envelope.group.id).toArray()
        : []
      const localPayments = localGroup
        ? await db.payments.where('groupId').equals(envelope.group.id).toArray()
        : []

      const decision = computeSyncMerge(envelope, localGroup, localExpenses, localPayments)

      await db.transaction('rw', [db.groups, db.expenses, db.payments], async () => {
        // ── Group + Members ─────────────────────────────────────────
        if (decision.groupAction !== 'conflict') {
          await db.groups.put(decision.mergedGroup)
        } else {
          // On conflict keep local metadata but persist merged members
          await db.groups.update(envelope.group.id, {
            members: decision.mergedGroup.members,
          })
        }

        // ── Expenses ────────────────────────────────────────────────
        for (const item of decision.expenses) {
          if (item.action === 'create' || item.action === 'update') {
            await db.expenses.put(item.expense)
          }
        }

        // ── Payments ────────────────────────────────────────────────
        for (const item of decision.payments) {
          if (item.action === 'create' || item.action === 'update') {
            await db.payments.put(item.payment)
          }
        }
      })

      return decision.report
    },

    /**
     * Preview the result of applying a sync envelope without persisting any changes.
     * Useful for showing the user what would change before confirming.
     * Returns the same SyncReport as applyGroupJson would, but performs no writes.
     */
    async previewGroupJson(raw: unknown): Promise<SyncReport> {
      const envelope = SyncEnvelopeV1Schema.parse(raw)

      const localGroup = await db.groups.get(envelope.group.id)
      const localExpenses = localGroup
        ? await db.expenses.where('groupId').equals(envelope.group.id).toArray()
        : []
      const localPayments = localGroup
        ? await db.payments.where('groupId').equals(envelope.group.id).toArray()
        : []

      const decision = computeSyncMerge(envelope, localGroup, localExpenses, localPayments)
      return decision.report
    },
  },
}
