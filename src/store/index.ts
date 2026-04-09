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
  archiveGroup: (id: string) => Promise<void>
  unarchiveGroup: (id: string) => Promise<void>
  addMember: (groupId: string, name: string) => Promise<void>
  removeMember: (groupId: string, memberId: string) => Promise<void>
  renameMember: (groupId: string, memberId: string, newName: string) => Promise<void>
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'deleted' | 'archived'>) => Promise<void>
  updateExpense: (expense: Expense) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  archiveAllSettledExpenses: (groupId: string) => Promise<number>
  unarchiveExpense: (id: string) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>) => Promise<void>
  updatePayment: (payment: Payment) => Promise<void>
  deletePayment: (id: string) => Promise<void>
  setCurrentGroup: (groupId: string | null) => void
  exportGroup: (groupId: string) => Promise<void>
  importGroup: (raw: unknown) => Promise<Group>
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

  archiveGroup: async (id: string) => {
    await reparteix.archiveGroup(id)
    await get().loadGroups()
  },

  unarchiveGroup: async (id: string) => {
    await reparteix.unarchiveGroup(id)
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

  archiveAllSettledExpenses: async (groupId: string) => {
    const count = await reparteix.archiveAllSettledExpenses(groupId)
    if (count > 0) await get().loadGroupData(groupId)
    return count
  },

  unarchiveExpense: async (id: string) => {
    const expense = get().expenses.find((e) => e.id === id)
    await reparteix.unarchiveExpense(id)
    if (expense) await get().loadGroupData(expense.groupId)
  },

  addPayment: async (payment) => {
    await reparteix.addPayment(payment)
    await get().loadGroupData(payment.groupId)
  },

  updatePayment: async (payment) => {
    await reparteix.updatePayment(payment)
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

  exportGroup: async (groupId: string) => {
    const data = await reparteix.exportGroup(groupId)
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/vnd.reparteix+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const groupName = get().groups.find((g) => g.id === groupId)?.name ?? 'grup'
    const slug = groupName.replace(/\s+/g, '-').toLowerCase()
    const date = new Date().toISOString().slice(0, 10)
    a.download = `reparteix-export-${slug}-${date}.reparteix.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  importGroup: async (raw: unknown) => {
    const group = await reparteix.importGroup(raw)
    await get().loadGroups()
    return group
  },
}))
