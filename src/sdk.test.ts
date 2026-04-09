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

  // ─── Archive / Unarchive ─────────────────────────────────────────

  describe('archive / unarchive', () => {
    it('archiveGroup marks the group as archived', async () => {
      const group = await reparteix.createGroup('Viatge')
      expect(group.archived).toBe(false)

      await reparteix.archiveGroup(group.id)

      const found = await reparteix.getGroup(group.id)
      expect(found!.archived).toBe(true)
    })

    it('unarchiveGroup restores write access', async () => {
      const group = await reparteix.createGroup('Sopar')
      await reparteix.archiveGroup(group.id)
      await reparteix.unarchiveGroup(group.id)

      const found = await reparteix.getGroup(group.id)
      expect(found!.archived).toBe(false)
    })

    it('blocks updateGroup on an archived group', async () => {
      const group = await reparteix.createGroup('Antic')
      await reparteix.archiveGroup(group.id)

      await expect(
        reparteix.updateGroup(group.id, { name: 'Nou nom' }),
      ).rejects.toThrow('Cannot modify an archived group')
    })

    it('blocks addMember on an archived group', async () => {
      const group = await reparteix.createGroup('Pis')
      await reparteix.archiveGroup(group.id)

      await expect(reparteix.addMember(group.id, 'Anna')).rejects.toThrow(
        'Cannot modify an archived group',
      )
    })

    it('blocks addExpense on an archived group', async () => {
      const group = await reparteix.createGroup('Grup')
      const anna = await reparteix.addMember(group.id, 'Anna')
      await reparteix.archiveGroup(group.id)

      await expect(
        reparteix.addExpense({
          groupId: group.id,
          description: 'Pizza',
          amount: 20,
          payerId: anna.id,
          splitAmong: [anna.id],
          date: '2024-06-01',
        }),
      ).rejects.toThrow('Cannot modify an archived group')
    })

    it('blocks addPayment on an archived group', async () => {
      const group = await reparteix.createGroup('Grup')
      const anna = await reparteix.addMember(group.id, 'Anna')
      const bernat = await reparteix.addMember(group.id, 'Bernat')
      await reparteix.archiveGroup(group.id)

      await expect(
        reparteix.addPayment({
          groupId: group.id,
          fromId: bernat.id,
          toId: anna.id,
          amount: 10,
          date: '2024-06-01',
        }),
      ).rejects.toThrow('Cannot modify an archived group')
    })

    it('listGroups returns archived groups', async () => {
      const g1 = await reparteix.createGroup('Actiu')
      const g2 = await reparteix.createGroup('Arxivat')
      await reparteix.archiveGroup(g2.id)

      const all = await reparteix.listGroups()
      const ids = all.map((g) => g.id)
      expect(ids).toContain(g1.id)
      expect(ids).toContain(g2.id)

      const archived = all.find((g) => g.id === g2.id)!
      expect(archived.archived).toBe(true)
    })

    it('unarchive allows mutations again', async () => {
      const group = await reparteix.createGroup('Reactivar')
      await reparteix.archiveGroup(group.id)
      await reparteix.unarchiveGroup(group.id)

      const anna = await reparteix.addMember(group.id, 'Anna')
      expect(anna.name).toBe('Anna')
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

    it('archives and unarchives a settled expense', async () => {
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

      await reparteix.addPayment({
        groupId: group.id,
        fromId: bernat.id,
        toId: anna.id,
        amount: 10,
        date: '2024-06-02',
      })

      const archivedCount = await reparteix.archiveAllSettledExpenses(group.id)
      expect(archivedCount).toBe(1)

      const archivedExpense = await db.expenses.get(expense.id)
      expect(archivedExpense?.archived).toBe(true)

      await reparteix.unarchiveExpense(expense.id)
      const restoredExpense = await db.expenses.get(expense.id)
      expect(restoredExpense?.archived).toBe(false)
    })

    it('returns 0 when archiving settled expenses for an unknown group', async () => {
      await expect(reparteix.archiveAllSettledExpenses('missing-group')).resolves.toBe(0)
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

    it('updates a payment', async () => {
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

      const updated = await reparteix.updatePayment({
        ...payment,
        amount: 12,
      })

      expect(updated.amount).toBe(12)

      const [stored] = await reparteix.listPayments(group.id)
      expect(stored.amount).toBe(12)
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

  // ─── Sync ────────────────────────────────────────────────────────

  describe('sync', () => {
    // ── helpers ───────────────────────────────────────────────────

    function makeEnvelope(groupName: string = 'Sync test') {
      return async () => {
        const g = await reparteix.createGroup(groupName)
        const anna = await reparteix.addMember(g.id, 'Anna')
        const bernat = await reparteix.addMember(g.id, 'Bernat')
        const expense = await reparteix.addExpense({
          groupId: g.id,
          description: 'Pizza',
          amount: 30,
          payerId: anna.id,
          splitAmong: [anna.id, bernat.id],
          date: '2024-06-01',
        })
        const payment = await reparteix.addPayment({
          groupId: g.id,
          fromId: bernat.id,
          toId: anna.id,
          amount: 15,
          date: '2024-06-02',
        })
        const latestGroup = (await reparteix.getGroup(g.id))!
        return {
          version: 1 as const,
          exportedAt: new Date().toISOString(),
          group: latestGroup,
          expenses: [expense],
          payments: [payment],
        }
      }
    }

    it('rejects an invalid envelope schema', async () => {
      await expect(reparteix.sync.applyGroupJson({ foo: 'bar' })).rejects.toThrow()
    })

    it('does not mutate anything on a failed sync', async () => {
      const before = await reparteix.listGroups()
      await expect(reparteix.sync.applyGroupJson({ foo: 'bar' })).rejects.toThrow()
      const after = await reparteix.listGroups()
      expect(after).toHaveLength(before.length)
    })

    it('creates a new group when it does not exist locally', async () => {
      const build = makeEnvelope()
      const envelope = await build()

      // clear DB then apply
      await db.groups.clear()
      await db.expenses.clear()
      await db.payments.clear()

      const report = await reparteix.sync.applyGroupJson(envelope)

      expect(report.created.groups).toBe(1)
      expect(report.created.members).toBe(2)
      expect(report.created.expenses).toBe(1)
      expect(report.created.payments).toBe(1)

      const groups = await reparteix.listGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0].name).toBe('Sync test')
    })

    it('skips group and items when local version is newer', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      // bump local group to a newer timestamp
      await reparteix.updateGroup(envelope.group.id, { name: 'Nom local nou' })

      const report = await reparteix.sync.applyGroupJson(envelope)

      expect(report.updated.groups).toBe(0)
      expect(report.skipped.expenses).toBe(1)
      expect(report.skipped.payments).toBe(1)

      const g = await reparteix.getGroup(envelope.group.id)
      expect(g!.name).toBe('Nom local nou')
    })

    it('updates group and items when remote version is newer', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      // Tamper: make everything in the envelope newer
      const future = new Date(Date.now() + 60_000).toISOString()
      const newerEnvelope = {
        ...envelope,
        group: {
          ...envelope.group,
          name: 'Nom remot nou',
          updatedAt: future,
          members: envelope.group.members.map((m) => ({ ...m, updatedAt: future })),
        },
        expenses: envelope.expenses.map((e) => ({
          ...e,
          description: 'Despesa actualitzada',
          updatedAt: future,
        })),
        payments: envelope.payments.map((p) => ({ ...p, amount: 20, updatedAt: future })),
      }

      const report = await reparteix.sync.applyGroupJson(newerEnvelope)

      expect(report.updated.groups).toBe(1)
      expect(report.updated.members).toBeGreaterThanOrEqual(1)
      expect(report.updated.expenses).toBe(1)
      expect(report.updated.payments).toBe(1)

      const g = await reparteix.getGroup(envelope.group.id)
      expect(g!.name).toBe('Nom remot nou')
    })

    it('detects same-timestamp divergence as a conflict and does not overwrite', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      // Tamper: same timestamp but different group name
      const sameTs = envelope.group.updatedAt
      const conflictingEnvelope = {
        ...envelope,
        group: { ...envelope.group, name: 'Nom conflictiu', updatedAt: sameTs },
      }

      const report = await reparteix.sync.applyGroupJson(conflictingEnvelope)

      expect(report.conflicts).toHaveLength(1)
      expect(report.conflicts[0].entity).toBe('group')
      expect(report.conflicts[0].reason).toBe('same_timestamp_divergence')

      // Local name preserved
      const g = await reparteix.getGroup(envelope.group.id)
      expect(g!.name).toBe('Grup')
    })

    it('rejects expense with unknown payerId and continues with rest', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      const bogusExpense = {
        ...envelope.expenses[0],
        id: 'bogus-expense',
        payerId: 'unknown-member',
      }
      const envelopeWithBogus = {
        ...envelope,
        expenses: [...envelope.expenses, bogusExpense],
      }

      const report = await reparteix.sync.applyGroupJson(envelopeWithBogus)

      expect(report.rejected).toHaveLength(1)
      expect(report.rejected[0].entity).toBe('expense')
      expect(report.rejected[0].id).toBe('bogus-expense')

      // Valid expense was still applied
      expect(report.skipped.expenses + report.created.expenses + report.updated.expenses).toBe(1)
    })

    it('rejects payment with unknown fromId and continues with rest', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      const bogusPayment = {
        ...envelope.payments[0],
        id: 'bogus-payment',
        fromId: 'unknown-member',
      }
      const envelopeWithBogus = {
        ...envelope,
        payments: [...envelope.payments, bogusPayment],
      }

      const report = await reparteix.sync.applyGroupJson(envelopeWithBogus)

      expect(report.rejected).toHaveLength(1)
      expect(report.rejected[0].entity).toBe('payment')
      expect(report.rejected[0].id).toBe('bogus-payment')
    })

    it('applies remote soft-delete when remote is newer', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      const future = new Date(Date.now() + 60_000).toISOString()
      const deletedEnvelope = {
        ...envelope,
        expenses: envelope.expenses.map((e) => ({
          ...e,
          deleted: true,
          updatedAt: future,
        })),
      }

      await reparteix.sync.applyGroupJson(deletedEnvelope)

      const expenses = await db.expenses
        .where('groupId')
        .equals(envelope.group.id)
        .toArray()
      expect(expenses[0].deleted).toBe(true)
    })

    it('creates a new member from remote that does not exist locally', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      const newMember = {
        id: 'new-remote-member',
        name: 'Carla',
        color: '#10b981',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deleted: false,
      }
      const envelopeWithExtra = {
        ...envelope,
        group: {
          ...envelope.group,
          members: [...envelope.group.members, newMember],
        },
      }

      const report = await reparteix.sync.applyGroupJson(envelopeWithExtra)

      expect(report.created.members).toBeGreaterThanOrEqual(1)
      const g = await reparteix.getGroup(envelope.group.id)
      const found = g!.members.find((m) => m.id === 'new-remote-member')
      expect(found).toBeDefined()
      expect(found!.name).toBe('Carla')
    })

    it('preview does not persist any changes', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      // clear and preview without applying
      await db.groups.clear()
      await db.expenses.clear()
      await db.payments.clear()

      const report = await reparteix.sync.previewGroupJson(envelope)

      expect(report.created.groups).toBe(1)

      // Nothing was actually written
      const groups = await reparteix.listGroups()
      expect(groups).toHaveLength(0)
    })

    it('preview returns same report as applyGroupJson without persisting', async () => {
      const build = makeEnvelope('Grup')
      const envelope = await build()

      const future = new Date(Date.now() + 60_000).toISOString()
      const newerEnvelope = {
        ...envelope,
        group: { ...envelope.group, name: 'Remot nou', updatedAt: future },
      }

      const previewReport = await reparteix.sync.previewGroupJson(newerEnvelope)
      expect(previewReport.updated.groups).toBe(1)

      // group name unchanged
      const g = await reparteix.getGroup(envelope.group.id)
      expect(g!.name).toBe('Grup')
    })

    it('handles envelope with no expenses or payments (minimal snapshot)', async () => {
      const group = await reparteix.createGroup('Minimal')
      const envelope = {
        version: 1 as const,
        exportedAt: new Date().toISOString(),
        group: (await reparteix.getGroup(group.id))!,
        expenses: [],
        payments: [],
      }

      const report = await reparteix.sync.applyGroupJson(envelope)
      expect(report.created.expenses).toBe(0)
      expect(report.created.payments).toBe(0)
      expect(report.rejected).toHaveLength(0)
    })
  })

  // ─── Import / Export ──────────────────────────────────────────────

  describe('import / export', () => {
    it('exports a group as a ReparteixExportV1 envelope', async () => {
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

      expect(exported.format).toBe('reparteix-export')
      expect(exported.version).toBe(1)
      expect(exported.exportedAt).toBeTruthy()
      expect(exported.data.groups).toHaveLength(1)
      expect(exported.data.groups[0].id).toBe(group.id)
      expect(exported.data.groups[0].name).toBe('Export test')
      expect(exported.data.expenses).toHaveLength(1)
      expect(exported.data.expenses[0].description).toBe('Sopar')
      expect(exported.data.payments).toHaveLength(1)
      expect(exported.data.payments[0].amount).toBe(20)
    })

    it('throws when exporting a non-existent group', async () => {
      await expect(reparteix.exportGroup('nope')).rejects.toThrow('Group not found')
    })

    it('imports a group from a valid ReparteixExportV1 envelope', async () => {
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

    it('imports a group from legacy GroupExport format', async () => {
      const group = await reparteix.createGroup('Legacy test')
      const anna = await reparteix.addMember(group.id, 'Anna')
      await reparteix.addExpense({
        groupId: group.id,
        description: 'Bus',
        amount: 5,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-08-01',
      })

      // Build a legacy format object manually
      const fullGroup = await db.groups.get(group.id)
      const allExpenses = await db.expenses.where('groupId').equals(group.id).toArray()
      const legacyExport = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        group: fullGroup,
        expenses: allExpenses,
        payments: [],
      }

      // Clear and re-import via legacy path
      await db.groups.clear()
      await db.expenses.clear()
      await db.payments.clear()

      const imported = await reparteix.importGroup(legacyExport)

      expect(imported.id).toBe(group.id)
      expect(imported.name).toBe('Legacy test')

      const expenses = await reparteix.listExpenses(group.id)
      expect(expenses).toHaveLength(1)
      expect(expenses[0].description).toBe('Bus')
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
      expect(exported.data.expenses).toHaveLength(1)
      expect(exported.data.expenses[0].deleted).toBe(true)

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
        data: {
          ...exported.data,
          groups: [{ ...exported.data.groups[0], name: 'Nom del futur', updatedAt: future }],
        },
      }

      await reparteix.importGroup(newerExport)

      const current = await reparteix.getGroup(group.id)
      expect(current?.name).toBe('Nom del futur')
    })

    it('rejects an import with an invalid schema', async () => {
      await expect(reparteix.importGroup({ foo: 'bar' })).rejects.toThrow()
    })

    it('rejects an import with format but invalid data', async () => {
      await expect(
        reparteix.importGroup({ format: 'reparteix-export', version: 1, data: {} }),
      ).rejects.toThrow()
    })

    it('does not mutate anything on a failed import', async () => {
      const before = await reparteix.listGroups()
      await expect(reparteix.importGroup({ foo: 'bar' })).rejects.toThrow()
      const after = await reparteix.listGroups()
      expect(after).toHaveLength(before.length)
    })

    it('restores a locally deleted group when importing a non-deleted version', async () => {
      const group = await reparteix.createGroup('Grup a restaurar')
      const exported = await reparteix.exportGroup(group.id)

      // Delete the group locally — now local has deleted: true with newer updatedAt
      await reparteix.deleteGroup(group.id)
      const deletedGroup = await db.groups.get(group.id)
      expect(deletedGroup?.deleted).toBe(true)

      // Re-import the older (non-deleted) export — should restore the group
      const restored = await reparteix.importGroup(exported)

      expect(restored.deleted).toBe(false)
      expect(restored.id).toBe(group.id)

      // listGroups must now include the restored group
      const all = await reparteix.listGroups()
      expect(all.some((g) => g.id === group.id)).toBe(true)
    })
  })

  // ─── Share ────────────────────────────────────────────────────────

  describe('share', () => {
    it('encodes and decodes a group roundtrip', async () => {
      const group = await reparteix.createGroup('Compartit')
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

      const encoded = await reparteix.share.encodeGroup(group.id)
      expect(encoded).toMatch(/^v1\./)
      expect(encoded.length).toBeGreaterThan(10)

      const envelope = await reparteix.share.decodeGroup(encoded)

      expect(envelope.version).toBe(1)
      expect(envelope.group.id).toBe(group.id)
      expect(envelope.group.name).toBe('Compartit')
      expect(envelope.expenses).toHaveLength(1)
      expect(envelope.expenses[0].description).toBe('Sopar')
      expect(envelope.payments).toHaveLength(1)
      expect(envelope.payments[0].amount).toBe(20)
    })

    it('decoded payload is a valid SyncEnvelopeV1', async () => {
      const group = await reparteix.createGroup('Valid')
      const encoded = await reparteix.share.encodeGroup(group.id)
      const envelope = await reparteix.share.decodeGroup(encoded)

      expect(envelope.group.members).toEqual([])
      expect(envelope.expenses).toEqual([])
      expect(envelope.payments).toEqual([])
    })

    it('throws for an unsupported version prefix', async () => {
      await expect(reparteix.share.decodeGroup('v2.abc')).rejects.toThrow(
        'Unsupported share format version',
      )
    })

    it('throws for invalid base64url data', async () => {
      await expect(reparteix.share.decodeGroup('v1.!!!invalid!!!')).rejects.toThrow()
    })

    it('throws when encoding a non-existent group', async () => {
      await expect(reparteix.share.encodeGroup('non-existent')).rejects.toThrow(
        'Group not found',
      )
    })

    it('encoded share can be applied via sync.applyGroupJson', async () => {
      const group = await reparteix.createGroup('Share + Sync')
      const anna = await reparteix.addMember(group.id, 'Anna')
      await reparteix.addExpense({
        groupId: group.id,
        description: 'Mercat',
        amount: 30,
        payerId: anna.id,
        splitAmong: [anna.id],
        date: '2024-06-01',
      })

      const encoded = await reparteix.share.encodeGroup(group.id)

      // Clear and re-import via sync
      await db.groups.clear()
      await db.expenses.clear()
      await db.payments.clear()

      const envelope = await reparteix.share.decodeGroup(encoded)
      const report = await reparteix.sync.applyGroupJson(envelope)

      expect(report.created.groups).toBe(1)
      expect(report.created.expenses).toBe(1)

      const restored = await reparteix.getGroup(group.id)
      expect(restored?.name).toBe('Share + Sync')
    })

    it('decodeGroup throws a clear error when CompressionStream is unavailable', async () => {
      const original = globalThis.DecompressionStream
      // @ts-expect-error — simulate missing API
      globalThis.DecompressionStream = undefined
      await expect(reparteix.share.decodeGroup('v1.abc')).rejects.toThrow(
        'El teu navegador no suporta la compressió',
      )
      globalThis.DecompressionStream = original
    })

    it('encodeGroup throws a clear error when CompressionStream is unavailable', async () => {
      const group = await reparteix.createGroup('No compress')
      const original = globalThis.CompressionStream
      // @ts-expect-error — simulate missing API
      globalThis.CompressionStream = undefined
      await expect(reparteix.share.encodeGroup(group.id)).rejects.toThrow(
        'El teu navegador no suporta la compressió',
      )
      globalThis.CompressionStream = original
    })
  })
})
