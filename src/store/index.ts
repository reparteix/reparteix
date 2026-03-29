import { create } from 'zustand'
import type { Group, Expense, Payment } from '../domain/entities'
import { reparteix } from '../sdk'

interface AppState {
  groups: Group[]
  groupTotals: Record<string, number>
  expenses: Expense[]
  payments: Payment[]
  currentGroupId: string | null

  // Actions
  loadGroups: () => Promise<void>
  loadGroupData: (groupId: string) => Promise<void>
  addGroup: (name: string) => Promise<Group>
  updateGroup: (id: string, updates: { name?: string; description?: string; icon?: string; currency?: string }) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  addMember: (groupId: string, name: string) => Promise<void>
  removeMember: (groupId: string, memberId: string) => Promise<void>
  renameMember: (groupId: string, memberId: string, newName: string) => Promise<void>
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>) => Promise<void>
  updateExpense: (expense: Expense) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>) => Promise<void>
  deletePayment: (id: string) => Promise<void>
  setCurrentGroup: (groupId: string | null) => void
}

export const useStore = create<AppState>((set, get) => ({
  groups: [],
  groupTotals: {},
  expenses: [],
  payments: [],
  currentGroupId: null,

  loadGroups: async () => {
    const [groups, groupTotals] = await Promise.all([
      reparteix.listGroups(),
      reparteix.listExpenseTotalsByGroup(),
    ])
    set({ groups, groupTotals })
  },

  loadGroupData: async (groupId: string) => {
    const [expenses, payments] = await Promise.all([
      reparteix.listExpenses(groupId),
      reparteix.listPayments(groupId),
    ])
    set({ expenses, payments, currentGroupId: groupId })
  },

  addGroup: async (name: string) => {
    const group = await reparteix.createGroup(name)
    await get().loadGroups()
    return group
  },

  updateGroup: async (id: string, updates) => {
    await reparteix.updateGroup(id, updates)
    await get().loadGroups()
  },

  deleteGroup: async (id: string) => {
    await reparteix.deleteGroup(id)
    await get().loadGroups()
  },

  addMember: async (groupId: string, name: string) => {
    await reparteix.addMember(groupId, name)
    await get().loadGroups()
    await get().loadGroupData(groupId)
  },

  removeMember: async (groupId: string, memberId: string) => {
    await reparteix.removeMember(groupId, memberId)
    await get().loadGroups()
    await get().loadGroupData(groupId)
  },

  renameMember: async (groupId: string, memberId: string, newName: string) => {
    await reparteix.renameMember(groupId, memberId, newName)
    await get().loadGroups()
    await get().loadGroupData(groupId)
  },

  addExpense: async (expense) => {
    await reparteix.addExpense(expense)
    await Promise.all([
      get().loadGroupData(expense.groupId),
      get().loadGroups(),
    ])
  },

  updateExpense: async (expense) => {
    await reparteix.updateExpense(expense)
    await Promise.all([
      get().loadGroupData(expense.groupId),
      get().loadGroups(),
    ])
  },

  deleteExpense: async (id: string) => {
    const expense = get().expenses.find((e) => e.id === id)
    await reparteix.deleteExpense(id)
    if (expense) {
      await Promise.all([
        get().loadGroupData(expense.groupId),
        get().loadGroups(),
      ])
    }
  },

  addPayment: async (payment) => {
    await reparteix.addPayment(payment)
    await get().loadGroupData(payment.groupId)
  },

  deletePayment: async (id: string) => {
    const payment = get().payments.find((p) => p.id === id)
    await reparteix.deletePayment(id)
    if (payment) await get().loadGroupData(payment.groupId)
  },

  setCurrentGroup: (groupId) => {
    set({ currentGroupId: groupId })
  },
}))
