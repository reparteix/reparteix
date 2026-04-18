import Dexie, { type EntityTable } from 'dexie'
import type { Group, Expense, Payment, ActivityEntry } from '../../domain/entities'

const db = new Dexie('reparteix') as Dexie & {
  groups: EntityTable<Group, 'id'>
  expenses: EntityTable<Expense, 'id'>
  payments: EntityTable<Payment, 'id'>
  activity: EntityTable<ActivityEntry, 'id'>
}

db.version(1).stores({
  groups: 'id, name, deleted',
  expenses: 'id, groupId, deleted',
  payments: 'id, groupId, deleted',
})

db.version(2)
  .stores({
    groups: 'id, name, deleted, archived',
    expenses: 'id, groupId, deleted',
    payments: 'id, groupId, deleted',
  })
  .upgrade((tx) => {
    return tx
      .table('groups')
      .toCollection()
      .modify((group: Record<string, unknown>) => {
        if (group['archived'] === undefined) {
          group['archived'] = false
        }
      })
  })

db.version(3)
  .stores({
    groups: 'id, name, deleted, archived',
    expenses: 'id, groupId, deleted, archived',
    payments: 'id, groupId, deleted',
  })
  .upgrade((tx) => {
    return tx
      .table('expenses')
      .toCollection()
      .modify((expense: Record<string, unknown>) => {
        if (expense['archived'] === undefined) {
          expense['archived'] = false
        }
      })
  })

db.version(4)
  .stores({
    groups: 'id, name, deleted, archived',
    expenses: 'id, groupId, deleted, archived',
    payments: 'id, groupId, deleted',
  })
  .upgrade((tx) => {
    return tx
      .table('groups')
      .toCollection()
      .modify((group: Record<string, unknown>) => {
        if (group['syncPassphrase'] === undefined) {
          group['syncPassphrase'] = ''
        }
      })
  })

db.version(5).stores({
  groups: 'id, name, deleted, archived',
  expenses: 'id, groupId, deleted, archived',
  payments: 'id, groupId, deleted',
  activity: 'id, groupId, entityType, entityId, action, at',
})

export { db }
