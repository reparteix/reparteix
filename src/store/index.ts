import { create } from 'zustand'
import type { Group, Expense, Payment, Member } from '../domain/entities'
import { db } from '../infra/db'

interface AppState {
  groups: Group[]
  expenses: Expense[]
  payments: Payment[]
  currentGroupId: string | null

  // Actions
  loadGroups: () => Promise<void>
  loadGroupData: (groupId: string) => Promise<void>
  addGroup: (name: string, currency: string) => Promise<Group>
  deleteGroup: (id: string) => Promise<void>
  addMember: (groupId: string, name: string) => Promise<void>
  removeMember: (groupId: string, memberId: string) => Promise<void>
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>) => Promise<void>
  updateExpense: (expense: Expense) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>) => Promise<void>
  deletePayment: (id: string) => Promise<void>
  setCurrentGroup: (groupId: string | null) => void
}

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

export const useStore = create<AppState>((set, get) => ({
  groups: [],
  expenses: [],
  payments: [],
  currentGroupId: null,

  loadGroups: async () => {
    const groups = await db.groups.filter((g) => !g.deleted).toArray()
    set({ groups })
  },

  loadGroupData: async (groupId: string) => {
    const expenses = await db.expenses
      .where('groupId')
      .equals(groupId)
      .filter((e) => !e.deleted)
      .toArray()
    const payments = await db.payments
      .where('groupId')
      .equals(groupId)
      .filter((p) => !p.deleted)
      .toArray()
    set({ expenses, payments, currentGroupId: groupId })
  },

  addGroup: async (name: string, currency: string) => {
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
    await get().loadGroups()
    return group
  },

  deleteGroup: async (id: string) => {
    const group = await db.groups.get(id)
    if (group) {
      await db.groups.update(id, { deleted: true, updatedAt: now() })
      await get().loadGroups()
    }
  },

  addMember: async (groupId: string, name: string) => {
    const group = await db.groups.get(groupId)
    if (!group) return

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
    await get().loadGroups()
    await get().loadGroupData(groupId)
  },

  removeMember: async (groupId: string, memberId: string) => {
    const group = await db.groups.get(groupId)
    if (!group) return

    const updatedMembers = group.members.map((m) =>
      m.id === memberId ? { ...m, deleted: true, updatedAt: now() } : m,
    )
    await db.groups.update(groupId, {
      members: updatedMembers,
      updatedAt: now(),
    })
    await get().loadGroups()
    await get().loadGroupData(groupId)
  },

  addExpense: async (expense) => {
    const timestamp = now()
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.expenses.add(newExpense)
    await get().loadGroupData(expense.groupId)
  },

  updateExpense: async (expense) => {
    await db.expenses.update(expense.id, { ...expense, updatedAt: now() })
    await get().loadGroupData(expense.groupId)
  },

  deleteExpense: async (id: string) => {
    const expense = await db.expenses.get(id)
    if (expense) {
      await db.expenses.update(id, { deleted: true, updatedAt: now() })
      await get().loadGroupData(expense.groupId)
    }
  },

  addPayment: async (payment) => {
    const timestamp = now()
    const newPayment: Payment = {
      ...payment,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.payments.add(newPayment)
    await get().loadGroupData(payment.groupId)
  },

  deletePayment: async (id: string) => {
    const payment = await db.payments.get(id)
    if (payment) {
      await db.payments.update(id, { deleted: true, updatedAt: now() })
      await get().loadGroupData(payment.groupId)
    }
  },

  setCurrentGroup: (groupId) => {
    set({ currentGroupId: groupId })
  },
}))
