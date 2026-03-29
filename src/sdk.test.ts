import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { reparteix } from './sdk'
import { db } from './infra/db'

beforeEach(async () => {
  await db.groups.clear()
  await db.expenses.clear()
  await db.payments.clear()
})

describe('reparteix SDK', () => {
  // ─── Groups ──────────────────────────────────────────────────────

  describe('groups', () => {
    it('creates and lists groups', async () => {
      const group = await reparteix.createGroup('Viatge')

      expect(group.name).toBe('Viatge')
      expect(group.currency).toBe('EUR')
      expect(group.members).toEqual([])
      expect(group.deleted).toBe(false)
      expect(group.id).toBeTruthy()

      const groups = await reparteix.listGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0].id).toBe(group.id)
    })

    it('creates a group with explicit currency', async () => {
      const group = await reparteix.createGroup('Viatge', 'USD')
      expect(group.currency).toBe('USD')
    })

    it('gets a group by ID', async () => {
      const created = await reparteix.createGroup('Sopar')
      const found = await reparteix.getGroup(created.id)

      expect(found).toBeDefined()
      expect(found!.name).toBe('Sopar')
    })

    it('returns undefined for non-existent group', async () => {
      const found = await reparteix.getGroup('non-existent')
      expect(found).toBeUndefined()
    })

    it('soft-deletes a group', async () => {
      const group = await reparteix.createGroup('Eliminat')
      await reparteix.deleteGroup(group.id)

      const groups = await reparteix.listGroups()
      expect(groups).toHaveLength(0)

      const found = await reparteix.getGroup(group.id)
      expect(found).toBeUndefined()
    })

    it('updates group name, description, icon and currency', async () => {
      const group = await reparteix.createGroup('Original')
      const updated = await reparteix.updateGroup(group.id, {
        name: 'Actualitzat',
        description: 'Una descripció',
        icon: '🏖️',
        currency: 'USD',
      })

      expect(updated.name).toBe('Actualitzat')
      expect(updated.description).toBe('Una descripció')
      expect(updated.icon).toBe('🏖️')
      expect(updated.currency).toBe('USD')

      const found = await reparteix.getGroup(group.id)
      expect(found!.name).toBe('Actualitzat')
      expect(found!.description).toBe('Una descripció')
    })

    it('throws when updating non-existent group', async () => {
      await expect(
        reparteix.updateGroup('non-existent', { name: 'Test' }),
      ).rejects.toThrow()
    })
  })

  // ─── Members ─────────────────────────────────────────────────────

  describe('members', () => {
    it('adds a member to a group', async () => {
      const group = await reparteix.createGroup('Grup')
      const member = await reparteix.addMember(group.id, 'Anna')

      expect(member.name).toBe('Anna')
      expect(member.deleted).toBe(false)
      expect(member.id).toBeTruthy()

      const updated = await reparteix.getGroup(group.id)
      expect(updated!.members).toHaveLength(1)
      expect(updated!.members[0].name).toBe('Anna')
    })

    it('throws when adding member to non-existent group', async () => {
      await expect(
        reparteix.addMember('no-group', 'Test'),
      ).rejects.toThrow()
    })

    it('soft-deletes a member', async () => {
      const group = await reparteix.createGroup('Grup')
      const member = await reparteix.addMember(group.id, 'Bernat')

      await reparteix.removeMember(group.id, member.id)

      const updated = await reparteix.getGroup(group.id)
      const removed = updated!.members.find((m) => m.id === member.id)
      expect(removed!.deleted).toBe(true)
    })

    it('throws when removing a member who has expenses', async () => {
      const group = await reparteix.createGroup('Grup')
      const anna = await reparteix.addMember(group.id, 'Anna')

      await reparteix.addExpense({
        groupId: group.id,
        description: 'Pizza',
        amount: 20,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-06-01',
      })

      await expect(
        reparteix.removeMember(group.id, anna.id),
      ).rejects.toThrow()
    })

    it('throws when removing a member who has payments', async () => {
      const group = await reparteix.createGroup('Grup')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')

      await reparteix.addPayment({
        groupId: group.id,
        fromId: bernat.id,
        toId: anna.id,
        amount: 10,
        date: '2024-06-02',
      })

      await expect(
        reparteix.removeMember(group.id, anna.id),
      ).rejects.toThrow()
    })

    it('allows removing a member after all their expenses are deleted', async () => {
      const group = await reparteix.createGroup('Grup')
      const anna = await reparteix.addMember(group.id, 'Anna')

      const expense = await reparteix.addExpense({
        groupId: group.id,
        description: 'Pizza',
        amount: 20,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-06-01',
      })

      await reparteix.deleteExpense(expense.id)
      await reparteix.removeMember(group.id, anna.id)

      const updated = await reparteix.getGroup(group.id)
      const removed = updated!.members.find((m) => m.id === anna.id)
      expect(removed!.deleted).toBe(true)
    })

    it('renames a member', async () => {
      const group = await reparteix.createGroup('Grup')
      const member = await reparteix.addMember(group.id, 'Anna')

      await reparteix.renameMember(group.id, member.id, 'Ana')

      const updated = await reparteix.getGroup(group.id)
      const renamed = updated!.members.find((m) => m.id === member.id)
      expect(renamed!.name).toBe('Ana')
    })

    it('throws when renaming a member in a non-existent group', async () => {
      await expect(
        reparteix.renameMember('no-group', 'some-id', 'New Name'),
      ).rejects.toThrow()
    })

    it('throws when renaming a non-existent member', async () => {
      const group = await reparteix.createGroup('Grup')
      await expect(
        reparteix.renameMember(group.id, 'non-existent', 'New Name'),
      ).rejects.toThrow()
    })

    it('throws when renaming a soft-deleted member', async () => {
      const group = await reparteix.createGroup('Grup')
      const member = await reparteix.addMember(group.id, 'Anna')
      await reparteix.removeMember(group.id, member.id)

      await expect(
        reparteix.renameMember(group.id, member.id, 'Ana'),
      ).rejects.toThrow()
    })
  })

  // ─── Expenses ────────────────────────────────────────────────────

  describe('expenses', () => {
    it('adds and lists expenses', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')

      const expense = await reparteix.addExpense({
        groupId: group.id,
        description: 'Pizza',
        amount: 20,
        payerId: anna.id,
        splitAmong: [anna.id, bernat.id],
        date: '2024-06-01',
      })

      expect(expense.id).toBeTruthy()
      expect(expense.description).toBe('Pizza')

      const expenses = await reparteix.listExpenses(group.id)
      expect(expenses).toHaveLength(1)
    })

    it('updates an expense', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const expense = await reparteix.addExpense({
        groupId: group.id,
        description: 'Pizza',
        amount: 20,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-06-01',
      })

      const updated = await reparteix.updateExpense({
        ...expense,
        description: 'Pasta',
        amount: 15,
      })

      expect(updated.description).toBe('Pasta')
      expect(updated.amount).toBe(15)
    })

    it('soft-deletes an expense', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')
      await reparteix.addExpense({
        groupId: group.id,
        description: 'Pizza',
        amount: 20,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-06-01',
      })

      const [expense] = await reparteix.listExpenses(group.id)
      await reparteix.deleteExpense(expense.id)

      const remaining = await reparteix.listExpenses(group.id)
      expect(remaining).toHaveLength(0)
    })
  })

  // ─── Payments ────────────────────────────────────────────────────

  describe('payments', () => {
    it('adds and lists payments', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')

      const payment = await reparteix.addPayment({
        groupId: group.id,
        fromId: bernat.id,
        toId: anna.id,
        amount: 10,
        date: '2024-06-02',
      })

      expect(payment.id).toBeTruthy()
      expect(payment.amount).toBe(10)

      const payments = await reparteix.listPayments(group.id)
      expect(payments).toHaveLength(1)
    })

    it('soft-deletes a payment', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')

      const payment = await reparteix.addPayment({
        groupId: group.id,
        fromId: bernat.id,
        toId: anna.id,
        amount: 10,
        date: '2024-06-02',
      })

      await reparteix.deletePayment(payment.id)

      const payments = await reparteix.listPayments(group.id)
      expect(payments).toHaveLength(0)
    })
  })

  // ─── Balances & Settlements ──────────────────────────────────────

  describe('balances and settlements', () => {
    it('calculates balances for a group', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')

      await reparteix.addExpense({
        groupId: group.id,
        description: 'Pizza',
        amount: 30,
        payerId: anna.id,
        splitAmong: [anna.id, bernat.id],
        date: '2024-06-01',
      })

      const balances = await reparteix.getBalances(group.id)
      expect(balances).toHaveLength(2)

      const annaBalance = balances.find((b) => b.memberId === anna.id)
      const bernatBalance = balances.find((b) => b.memberId === bernat.id)
      expect(annaBalance!.total).toBe(15)
      expect(bernatBalance!.total).toBe(-15)
    })

    it('calculates settlements for a group', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')

      await reparteix.addExpense({
        groupId: group.id,
        description: 'Pizza',
        amount: 30,
        payerId: anna.id,
        splitAmong: [anna.id, bernat.id],
        date: '2024-06-01',
      })

      const settlements = await reparteix.getSettlements(group.id)
      expect(settlements).toHaveLength(1)
      expect(settlements[0]).toEqual({
        fromId: bernat.id,
        toId: anna.id,
        amount: 15,
      })
    })

    it('returns empty balances for non-existent group', async () => {
      const balances = await reparteix.getBalances('nope')
      expect(balances).toEqual([])
    })
  })
})
