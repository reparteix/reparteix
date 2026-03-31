import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useStore } from './index'
import { db } from '../infra/db'
import { reparteix } from '../sdk'

beforeEach(async () => {
  await db.groups.clear()
  await db.expenses.clear()
  await db.payments.clear()
  useStore.setState({
    groups: [],
    groupTotals: {},
    expenses: [],
    payments: [],
    currentGroupId: null,
  })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createGroupWithMembers(groupName: string, memberNames: string[]) {
  const { addGroup, addMember } = useStore.getState()
  const group = await addGroup(groupName)
  for (const name of memberNames) {
    await addMember(group.id, name)
  }
  return useStore.getState().groups.find((g) => g.id === group.id)!
}

// ─── Groups ───────────────────────────────────────────────────────────────────

describe('groups', () => {
  it("addGroup crea un grup i apareix a l'estat del store", async () => {
    const { addGroup } = useStore.getState()
    const group = await addGroup('Sopar')

    expect(group.name).toBe('Sopar')
    expect(group.id).toBeTruthy()

    const { groups } = useStore.getState()
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe(group.id)
    expect(groups[0].name).toBe('Sopar')
  })

  it("updateGroup actualitza les dades del grup a l'estat", async () => {
    const { addGroup, updateGroup } = useStore.getState()
    const group = await addGroup('Original')

    await updateGroup(group.id, { name: 'Actualitzat', description: 'Nova desc', icon: '🏖️', currency: 'USD' })

    const { groups } = useStore.getState()
    const updated = groups.find((g) => g.id === group.id)!
    expect(updated.name).toBe('Actualitzat')
    expect(updated.description).toBe('Nova desc')
    expect(updated.icon).toBe('🏖️')
    expect(updated.currency).toBe('USD')
  })

  it("deleteGroup elimina el grup de l'estat", async () => {
    const { addGroup, deleteGroup } = useStore.getState()
    const group = await addGroup('Per esborrar')

    await deleteGroup(group.id)

    const { groups } = useStore.getState()
    expect(groups.find((g) => g.id === group.id)).toBeUndefined()
    expect(groups).toHaveLength(0)
  })

  it("setCurrentGroup actualitza currentGroupId a l'estat", async () => {
    const { addGroup, setCurrentGroup } = useStore.getState()
    const group = await addGroup('Grup')

    setCurrentGroup(group.id)
    expect(useStore.getState().currentGroupId).toBe(group.id)

    setCurrentGroup(null)
    expect(useStore.getState().currentGroupId).toBeNull()
  })
})

// ─── Members ──────────────────────────────────────────────────────────────────

describe('members', () => {
  it("addMember afegeix un membre i és visible als grups de l'estat", async () => {
    const { addGroup, addMember } = useStore.getState()
    const group = await addGroup('Grup')

    await addMember(group.id, 'Anna')

    const { groups } = useStore.getState()
    const updated = groups.find((g) => g.id === group.id)!
    expect(updated.members).toHaveLength(1)
    expect(updated.members[0].name).toBe('Anna')
  })

  it('removeMember elimina un membre del grup', async () => {
    const { addGroup, addMember, removeMember } = useStore.getState()
    const group = await addGroup('Grup')
    await addMember(group.id, 'Anna')

    const member = useStore.getState().groups.find((g) => g.id === group.id)!.members[0]
    await removeMember(group.id, member.id)

    const { groups } = useStore.getState()
    const updated = groups.find((g) => g.id === group.id)!
    // removeMember fa un soft-delete: el membre té deleted: true
    const activeMembers = updated.members.filter((m) => !m.deleted)
    expect(activeMembers).toHaveLength(0)
  })

  it("renameMember canvia el nom d'un membre", async () => {
    const { addGroup, addMember, renameMember } = useStore.getState()
    const group = await addGroup('Grup')
    await addMember(group.id, 'Anna')

    const member = useStore.getState().groups.find((g) => g.id === group.id)!.members[0]
    await renameMember(group.id, member.id, 'Anna M.')

    const { groups } = useStore.getState()
    const updated = groups.find((g) => g.id === group.id)!
    expect(updated.members[0].name).toBe('Anna M.')
  })
})

// ─── Expenses ─────────────────────────────────────────────────────────────────

describe('expenses', () => {
  it('addExpense afegeix una despesa i actualitza expenses i groupTotals', async () => {
    const group = await createGroupWithMembers('Viatge', ['Anna', 'Bernat'])
    const members = group.members

    const { addExpense } = useStore.getState()
    await addExpense({
      groupId: group.id,
      description: 'Sopar',
      amount: 60,
      payerId: members[0].id,
      splitAmong: members.map((m) => m.id),
      date: '2024-01-15',
    })

    const { expenses, groupTotals } = useStore.getState()
    expect(expenses).toHaveLength(1)
    expect(expenses[0].description).toBe('Sopar')
    expect(expenses[0].amount).toBe(60)
    expect(groupTotals[group.id]).toBe(60)
  })

  it("updateExpense actualitza les dades de la despesa a l'estat", async () => {
    const group = await createGroupWithMembers('Viatge', ['Anna', 'Bernat'])
    const members = group.members

    const { addExpense, updateExpense } = useStore.getState()
    await addExpense({
      groupId: group.id,
      description: 'Sopar',
      amount: 60,
      payerId: members[0].id,
      splitAmong: members.map((m) => m.id),
      date: '2024-01-15',
    })

    const expense = useStore.getState().expenses[0]
    await updateExpense({ ...expense, description: 'Sopar actualitzat', amount: 80 })

    const { expenses } = useStore.getState()
    expect(expenses[0].description).toBe('Sopar actualitzat')
    expect(expenses[0].amount).toBe(80)
  })

  it("deleteExpense elimina la despesa de l'estat", async () => {
    const group = await createGroupWithMembers('Viatge', ['Anna', 'Bernat'])
    const members = group.members

    const { addExpense, deleteExpense } = useStore.getState()
    await addExpense({
      groupId: group.id,
      description: 'Sopar',
      amount: 60,
      payerId: members[0].id,
      splitAmong: members.map((m) => m.id),
      date: '2024-01-15',
    })

    const expenseId = useStore.getState().expenses[0].id
    await deleteExpense(expenseId)

    expect(useStore.getState().expenses).toHaveLength(0)
  })
})

// ─── Payments ─────────────────────────────────────────────────────────────────

describe('payments', () => {
  it("addPayment afegeix un pagament visible a l'estat", async () => {
    const group = await createGroupWithMembers('Viatge', ['Anna', 'Bernat'])
    const members = group.members

    const { addPayment } = useStore.getState()
    await addPayment({
      groupId: group.id,
      fromId: members[1].id,
      toId: members[0].id,
      amount: 30,
      date: '2024-01-20',
    })

    const { payments } = useStore.getState()
    expect(payments).toHaveLength(1)
    expect(payments[0].amount).toBe(30)
    expect(payments[0].fromId).toBe(members[1].id)
    expect(payments[0].toId).toBe(members[0].id)
  })

  it("deletePayment elimina el pagament de l'estat", async () => {
    const group = await createGroupWithMembers('Viatge', ['Anna', 'Bernat'])
    const members = group.members

    const { addPayment, deletePayment } = useStore.getState()
    await addPayment({
      groupId: group.id,
      fromId: members[1].id,
      toId: members[0].id,
      amount: 30,
      date: '2024-01-20',
    })

    const paymentId = useStore.getState().payments[0].id
    await deletePayment(paymentId)

    expect(useStore.getState().payments).toHaveLength(0)
  })
})

// ─── Integration flow ─────────────────────────────────────────────────────────

describe('integration flow', () => {
  it('flux complet: crear grup → afegir despesa → veure balanços', async () => {
    // 1. Crear grup i membres
    const { addGroup, addMember, addExpense, loadGroupData } = useStore.getState()
    const group = await addGroup('Viatge BCN')

    await addMember(group.id, 'Anna')
    await addMember(group.id, 'Bernat')
    await addMember(group.id, 'Clara')

    const updatedGroup = useStore.getState().groups.find((g) => g.id === group.id)!
    const members = updatedGroup.members
    const anna = members.find((m) => m.name === 'Anna')!
    const bernat = members.find((m) => m.name === 'Bernat')!
    const allIds = members.map((m) => m.id)

    // 2. Carregar dades del grup
    await loadGroupData(group.id)

    // 3. Afegir despeses
    await addExpense({
      groupId: group.id,
      description: 'Hotel',
      amount: 90,
      payerId: anna.id,
      splitAmong: allIds,
      date: '2024-06-01',
    })

    await addExpense({
      groupId: group.id,
      description: 'Restaurant',
      amount: 60,
      payerId: bernat.id,
      splitAmong: allIds,
      date: '2024-06-02',
    })

    // 4. Verificar despeses a l'estat
    const { expenses, groupTotals } = useStore.getState()
    expect(expenses).toHaveLength(2)
    expect(groupTotals[group.id]).toBe(150)

    // 5. Verificar balanços via SDK
    const balances = await reparteix.getBalances(group.id)
    expect(balances).toHaveLength(3)

    const totalBalance = balances.reduce((sum, b) => sum + b.total, 0)
    expect(Math.abs(totalBalance)).toBeLessThan(0.01) // allow floating-point rounding errors

    // Anna ha pagat 90, part proporcional 50 → balanç positiu
    const annaBalance = balances.find((b) => b.memberId === anna.id)!
    expect(annaBalance.total).toBeGreaterThan(0)

    // 6. Verificar liquidacions via SDK
    const settlements = await reparteix.getSettlements(group.id)
    expect(settlements.length).toBeGreaterThan(0)
  })
})
