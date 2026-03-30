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

    it('stores and returns receiptImage on an expense', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')

      const fakeBase64 = 'data:image/png;base64,iVBORw0KGgo='
      const expense = await reparteix.addExpense({
        groupId: group.id,
        description: 'Tiquet restaurant',
        amount: 45,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-06-01',
        receiptImage: fakeBase64,
      })

      expect(expense.receiptImage).toBe(fakeBase64)

      const [listed] = await reparteix.listExpenses(group.id)
      expect(listed.receiptImage).toBe(fakeBase64)
    })

    it('adds an expense without receiptImage', async () => {
      const group = await reparteix.createGroup('Sopar')
      const anna = await reparteix.addMember(group.id, 'Anna')

      const expense = await reparteix.addExpense({
        groupId: group.id,
        description: 'Cafè',
        amount: 2.5,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-06-01',
      })

      expect(expense.receiptImage).toBeUndefined()
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

  // ─── Import / Export ──────────────────────────────────────────────

  describe('import / export', () => {
    it('exports a group as a versioned JSON object', async () => {
      const group = await reparteix.createGroup('Export test')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')
      await reparteix.addExpense({
        groupId: group.id,
        description: 'Sopar',
        amount: 40,
        payerId: anna.id,
        splitAmong: [anna.id, bernat.id],
        date: '2024-06-01',
      })
      await reparteix.addPayment({
        groupId: group.id,
        fromId: bernat.id,
        toId: anna.id,
        amount: 20,
        date: '2024-06-02',
      })

      const exported = await reparteix.exportGroup(group.id)

      expect(exported.schemaVersion).toBe(1)
      expect(exported.exportedAt).toBeTruthy()
      expect(exported.group.id).toBe(group.id)
      expect(exported.group.name).toBe('Export test')
      expect(exported.expenses).toHaveLength(1)
      expect(exported.expenses[0].description).toBe('Sopar')
      expect(exported.payments).toHaveLength(1)
      expect(exported.payments[0].amount).toBe(20)
    })

    it('throws when exporting a non-existent group', async () => {
      await expect(reparteix.exportGroup('nope')).rejects.toThrow('Group not found')
    })

    it('imports a group from a valid export object', async () => {
      const group = await reparteix.createGroup('Import test')
      const anna = await reparteix.addMember(group.id, 'Anna')
      await reparteix.addExpense({
        groupId: group.id,
        description: 'Taxi',
        amount: 24,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-07-01',
      })

      const exported = await reparteix.exportGroup(group.id)

      // Clear DB and re-import
      await db.groups.clear()
      await db.expenses.clear()
      await db.payments.clear()

      const imported = await reparteix.importGroup(exported)

      expect(imported.id).toBe(group.id)
      expect(imported.name).toBe('Import test')

      const expenses = await reparteix.listExpenses(group.id)
      expect(expenses).toHaveLength(1)
      expect(expenses[0].description).toBe('Taxi')
    })

    it('includes deleted records in export and restores them on import', async () => {
      const group = await reparteix.createGroup('Deleted test')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const expense = await reparteix.addExpense({
        groupId: group.id,
        description: 'Despesa eliminada',
        amount: 10,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-07-01',
      })
      await reparteix.deleteExpense(expense.id)

      const exported = await reparteix.exportGroup(group.id)
      expect(exported.expenses).toHaveLength(1)
      expect(exported.expenses[0].deleted).toBe(true)

      await db.groups.clear()
      await db.expenses.clear()

      await reparteix.importGroup(exported)

      // listExpenses filters deleted, so we query DB directly
      const allExpenses = await db.expenses.where('groupId').equals(group.id).toArray()
      expect(allExpenses).toHaveLength(1)
      expect(allExpenses[0].deleted).toBe(true)
    })

    it('uses LWW when importing a record with the same ID', async () => {
      const group = await reparteix.createGroup('LWW test')
      const exported = await reparteix.exportGroup(group.id)

      // Locally update the group name after export (newer updatedAt)
      await reparteix.updateGroup(group.id, { name: 'Nom local (més nou)' })

      // Import the older export — local version should win
      await reparteix.importGroup(exported)

      const current = await reparteix.getGroup(group.id)
      expect(current?.name).toBe('Nom local (més nou)')
    })

    it('overwrites an existing record when the import has a newer updatedAt', async () => {
      const group = await reparteix.createGroup('LWW overwrite')
      const exported = await reparteix.exportGroup(group.id)

      // Tamper: make the exported group newer than the local copy
      const future = new Date(Date.now() + 60_000).toISOString()
      const newerExport = {
        ...exported,
        group: { ...exported.group, name: 'Nom del futur', updatedAt: future },
      }

      await reparteix.importGroup(newerExport)

      const current = await reparteix.getGroup(group.id)
      expect(current?.name).toBe('Nom del futur')
    })

    it('rejects an import with an invalid schema', async () => {
      await expect(reparteix.importGroup({ foo: 'bar' })).rejects.toThrow()
    })

    it('does not mutate anything on a failed import', async () => {
      const before = await reparteix.listGroups()
      await expect(reparteix.importGroup({ foo: 'bar' })).rejects.toThrow()
      const after = await reparteix.listGroups()
      expect(after).toHaveLength(before.length)
    })
  })
})
