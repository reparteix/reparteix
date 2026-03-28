import Dexie, { type EntityTable } from 'dexie'
import type { Group, Expense, Payment } from '../../domain/entities'

const db = new Dexie('reparteix') as Dexie & {
  groups: EntityTable<Group, 'id'>
  expenses: EntityTable<Expense, 'id'>
  payments: EntityTable<Payment, 'id'>
}

db.version(1).stores({
  groups: 'id, name, deleted',
  expenses: 'id, groupId, deleted',
  payments: 'id, groupId, deleted',
})

export { db }
