import type { Group, Expense, Payment, Member } from './domain/entities'
import {
  calculateBalances,
  calculateSettlements,
  type Balance,
  type Settlement,
} from './domain/services'
import { db } from './infra/db'

export type { Group, Expense, Payment, Member, Balance, Settlement }
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
  async createGroup(name: string, currency: string): Promise<Group> {
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
}
