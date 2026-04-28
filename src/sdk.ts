import type { Group, Expense, Payment, Member, GroupExport, ReparteixExportV1, SyncEnvelopeV1, ActivityEntry, ActivityAction } from './domain/entities'
import { GroupExportSchema, ReparteixExportV1Schema, SyncEnvelopeV1Schema } from './domain/entities'
import {
  calculateBalances,
  calculateSettlements,
  calculateNetting,
  calculateGroupExecutiveSummary,
  isExpenseArchivable,
  computeSyncMerge,
  getMemberColor,
  type Balance,
  type Settlement,
  type NettingResult,
  type GroupExecutiveSummary,
  type SyncReport,
} from './domain/services'
import { db } from './infra/db'
import { getLocalDeviceIdentity } from './lib/device-identity'

export type { Group, Expense, Payment, Member, ActivityEntry, ActivityAction, Balance, Settlement, NettingResult, GroupExecutiveSummary, GroupExport, ReparteixExportV1, SyncEnvelopeV1, SyncReport }
export { calculateBalances, calculateSettlements, calculateNetting, calculateGroupExecutiveSummary }


function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function sanitizeActivitySnapshot<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return JSON.parse(JSON.stringify(value)) as T
  }

  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  delete clone.receiptImage
  return clone as T
}

async function appendActivity(entry: Omit<ActivityEntry, 'id' | 'at' | 'actor'> & Partial<Pick<ActivityEntry, 'id' | 'at' | 'actor'>>): Promise<ActivityEntry> {
  const deviceIdentity = getLocalDeviceIdentity()
  const activity: ActivityEntry = {
    ...entry,
    id: entry.id ?? generateId(),
    actor: entry.actor ?? deviceIdentity.deviceLabel,
    at: entry.at ?? now(),
    meta: {
      ...entry.meta,
      deviceId: deviceIdentity.deviceId,
      deviceLabel: deviceIdentity.deviceLabel,
    },
  }
  await db.activity.add(activity)
  return activity
}

// ─── Share helpers (compression + base64url) ───────────────────────────────
//
// Requires CompressionStream / DecompressionStream (Compression Streams API).
// Browser support: Chrome 80+, Firefox 113+, Safari 16.4+ (iOS 16.4+, March 2023).
// See: https://caniuse.com/compressionstreams

function assertCompressionStreamSupport(): void {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') {
    throw new Error(
      'El teu navegador no suporta la compressió necessària per compartir per enllaç. ' +
      'Actualitza a Safari 16.4+, Chrome 80+, o Firefox 113+.',
    )
  }
}

const shareHelpers = {
  async compress(data: string): Promise<Uint8Array<ArrayBuffer>> {
    assertCompressionStreamSupport()
    const cs = new CompressionStream('deflate-raw')
    const writer = cs.writable.getWriter()
    writer.write(new TextEncoder().encode(data))
    writer.close()
    return new Uint8Array(await new Response(cs.readable).arrayBuffer())
  },

  async decompress(data: Uint8Array<ArrayBuffer>): Promise<string> {
    assertCompressionStreamSupport()
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    writer.write(data)
    writer.close()
    return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer())
  },

  toBase64Url(data: Uint8Array<ArrayBuffer>): string {
    let binary = ''
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i])
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  },

  fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const result = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      result[i] = binary.charCodeAt(i)
    }
    return result
  },
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
  async createGroup(name: string, currency = 'EUR'): Promise<Group> {
    const timestamp = now()
    const group: Group = {
      id: generateId(),
      name,
      currency,
      members: [],
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.groups.add(group)
    await appendActivity({ groupId: group.id, entityType: 'group', entityId: group.id, action: 'group.created', after: sanitizeActivitySnapshot(group) })
    return group
  },

  /** Duplicate an existing group as a fresh starting point without expenses or payments. */
  async duplicateGroup(
    sourceGroupId: string,
    template?: {
      name?: string
      description?: string
      icon?: string
      currency?: string
      members?: Array<{ name: string; color?: string }>
    },
  ): Promise<Group> {
    const sourceGroup = await db.groups.get(sourceGroupId)
    if (!sourceGroup || sourceGroup.deleted) throw new Error(`Group not found: ${sourceGroupId}`)

    const timestamp = now()
    const sourceMembers = sourceGroup.members.filter((member) => !member.deleted)
    const memberTemplates = template?.members ?? sourceMembers.map((member) => ({
      name: member.name,
      color: member.color,
    }))

    const members: Member[] = memberTemplates
      .map((member, index) => ({
        id: generateId(),
        name: member.name.trim(),
        color: member.color ?? getMemberColor(index),
        createdAt: timestamp,
        updatedAt: timestamp,
        deleted: false,
      }))
      .filter((member) => member.name.length > 0)

    const group: Group = {
      id: generateId(),
      name: template?.name?.trim() || `${sourceGroup.name} (còpia)`,
      description: template?.description?.trim() || sourceGroup.description,
      icon: template?.icon?.trim() || sourceGroup.icon,
      currency: template?.currency ?? sourceGroup.currency,
      members,
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }

    await db.groups.add(group)
    await appendActivity({
      groupId: group.id,
      entityType: 'group',
      entityId: group.id,
      action: 'group.created',
      after: sanitizeActivitySnapshot(group),
      meta: { sourceGroupId },
    })
    for (const member of members) {
      await appendActivity({
        groupId: group.id,
        entityType: 'member',
        entityId: member.id,
        action: 'member.added',
        after: sanitizeActivitySnapshot(member),
        meta: { memberName: member.name, sourceGroupId },
      })
    }
    return group
  },

  /** Update group metadata (name, description, icon, currency, syncPassphrase). Throws if the group is archived. */
  async updateGroup(
    id: string,
    updates: {
      name?: string
      description?: string
      icon?: string
      currency?: string
      syncPassphrase?: string
    },
  ): Promise<Group> {
    const group = await db.groups.get(id)
    if (!group) throw new Error(`Group not found: ${id}`)
    if (group.archived) throw new Error('Cannot modify an archived group')
    const patch: Partial<Group> = { ...updates, updatedAt: now() }
    await db.groups.update(id, patch)
    const updatedGroup = { ...group, ...patch }
    await appendActivity({ groupId: id, entityType: 'group', entityId: id, action: 'group.updated', before: sanitizeActivitySnapshot(group), after: sanitizeActivitySnapshot(updatedGroup) })
    return updatedGroup
  },

  /** Archive a group (makes it read-only). */
  async archiveGroup(id: string): Promise<void> {
    const group = await db.groups.get(id)
    if (group && !group.deleted) {
      const updatedGroup = { ...group, archived: true, updatedAt: now() }
      await db.groups.update(id, { archived: true, updatedAt: updatedGroup.updatedAt })
      await appendActivity({ groupId: id, entityType: 'group', entityId: id, action: 'group.archived', before: sanitizeActivitySnapshot(group), after: sanitizeActivitySnapshot(updatedGroup) })
    }
  },

  /** Unarchive a group (restores write access). */
  async unarchiveGroup(id: string): Promise<void> {
    const group = await db.groups.get(id)
    if (group && !group.deleted) {
      const updatedGroup = { ...group, archived: false, updatedAt: now() }
      await db.groups.update(id, { archived: false, updatedAt: updatedGroup.updatedAt })
      await appendActivity({ groupId: id, entityType: 'group', entityId: id, action: 'group.unarchived', before: sanitizeActivitySnapshot(group), after: sanitizeActivitySnapshot(updatedGroup) })
    }
  },

  /** Soft-delete a group. */
  async deleteGroup(id: string): Promise<void> {
    const group = await db.groups.get(id)
    if (group) {
      const updatedGroup = { ...group, deleted: true, updatedAt: now() }
      await db.groups.update(id, { deleted: true, updatedAt: updatedGroup.updatedAt })
      await appendActivity({ groupId: id, entityType: 'group', entityId: id, action: 'group.deleted', before: sanitizeActivitySnapshot(group), after: sanitizeActivitySnapshot(updatedGroup) })
    }
  },

  // ─── Members ───────────────────────────────────────────────────────

  /** Add a member to a group and return it. Throws if the group is archived. */
  async addMember(groupId: string, name: string): Promise<Member> {
    const group = await db.groups.get(groupId)
    if (!group) throw new Error('Group not found')
    if (group.archived) throw new Error('Cannot modify an archived group')

    const timestamp = now()
    const member: Member = {
      id: generateId(),
      name,
      color: getMemberColor(group.members.length),
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    const updatedMembers = [...group.members, member]
    await db.groups.update(groupId, {
      members: updatedMembers,
      updatedAt: timestamp,
    })
    await appendActivity({ groupId, entityType: 'member', entityId: member.id, action: 'member.added', after: sanitizeActivitySnapshot(member), meta: { memberName: member.name } })
    return member
  },

  /** Soft-delete a member from a group. Throws if the member has any expenses or payments, or if the group is archived. */
  async removeMember(groupId: string, memberId: string): Promise<void> {
    const group = await db.groups.get(groupId)
    if (!group) return
    if (group.archived) throw new Error('Cannot modify an archived group')

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

    const timestamp = now()
    const member = group.members.find((m) => m.id === memberId)
    const updatedMember = member ? { ...member, deleted: true, updatedAt: timestamp } : undefined
    const updatedMembers = group.members.map((m) =>
      m.id === memberId ? { ...m, deleted: true, updatedAt: timestamp } : m,
    )
    await db.groups.update(groupId, {
      members: updatedMembers,
      updatedAt: timestamp,
    })
    if (member && updatedMember) {
      await appendActivity({ groupId, entityType: 'member', entityId: memberId, action: 'member.removed', before: sanitizeActivitySnapshot(member), after: sanitizeActivitySnapshot(updatedMember), meta: { memberName: member.name } })
    }
  },

  /** Rename a member in a group. Throws if the group is archived. */
  async renameMember(
    groupId: string,
    memberId: string,
    newName: string,
  ): Promise<void> {
    const group = await db.groups.get(groupId)
    if (!group) throw new Error('Group not found')
    if (group.archived) throw new Error('Cannot modify an archived group')

    const member = group.members.find((m) => m.id === memberId)
    if (!member || member.deleted) throw new Error('Member not found')

    const timestamp = now()
    const updatedMember = { ...member, name: newName, updatedAt: timestamp }
    const updatedMembers = group.members.map((m) =>
      m.id === memberId ? updatedMember : m,
    )
    await db.groups.update(groupId, {
      members: updatedMembers,
      updatedAt: timestamp,
    })
    await appendActivity({ groupId, entityType: 'member', entityId: memberId, action: 'member.renamed', before: sanitizeActivitySnapshot(member), after: sanitizeActivitySnapshot(updatedMember), meta: { fromName: member.name, toName: newName } })
  },

  // ─── Expenses ──────────────────────────────────────────────────────

  /** Return a map of groupId → total expense amount for all non-deleted expenses. */
  async listExpenseTotalsByGroup(): Promise<Record<string, number>> {
    const expenses = await db.expenses.filter((e) => !e.deleted).toArray()
    return expenses.reduce(
      (acc, e) => {
        acc[e.groupId] = (acc[e.groupId] ?? 0) + e.amount
        return acc
      },
      {} as Record<string, number>,
    )
  },

  /** List all non-deleted expenses for a group. */
  async listExpenses(groupId: string): Promise<Expense[]> {
    return db.expenses
      .where('groupId')
      .equals(groupId)
      .filter((e) => !e.deleted)
      .toArray()
  },

  /** Add an expense and return it. Throws if the group is archived. */
  async addExpense(
    expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'deleted' | 'archived'>,
  ): Promise<Expense> {
    const group = await db.groups.get(expense.groupId)
    if (group?.archived) throw new Error('Cannot modify an archived group')
    const timestamp = now()
    const newExpense: Expense = {
      archived: false,
      ...expense,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.expenses.add(newExpense)
    await appendActivity({ groupId: newExpense.groupId, entityType: 'expense', entityId: newExpense.id, action: 'expense.created', after: sanitizeActivitySnapshot(newExpense) })
    return newExpense
  },

  /** Update an existing expense. Throws if the group is archived. */
  async updateExpense(expense: Expense): Promise<Expense> {
    const group = await db.groups.get(expense.groupId)
    if (group?.archived) throw new Error('Cannot modify an archived group')
    const updated = { ...expense, updatedAt: now() }
    const existing = await db.expenses.get(expense.id)
    await db.expenses.update(expense.id, updated)
    await appendActivity({ groupId: expense.groupId, entityType: 'expense', entityId: expense.id, action: 'expense.updated', before: sanitizeActivitySnapshot(existing ?? expense), after: sanitizeActivitySnapshot(updated) })
    return updated
  },

  /** Soft-delete an expense. Throws if the group is archived. */
  async deleteExpense(id: string): Promise<void> {
    const expense = await db.expenses.get(id)
    if (expense) {
      const group = await db.groups.get(expense.groupId)
      if (group?.archived) throw new Error('Cannot modify an archived group')
      const updatedExpense = { ...expense, deleted: true, updatedAt: now() }
      await db.expenses.update(id, { deleted: true, updatedAt: updatedExpense.updatedAt })
      await appendActivity({ groupId: expense.groupId, entityType: 'expense', entityId: id, action: 'expense.deleted', before: sanitizeActivitySnapshot(expense), after: sanitizeActivitySnapshot(updatedExpense) })
    }
  },

  /** Archive an expense (hides it from the active list). Throws if the group is archived. */
  async archiveExpense(id: string): Promise<void> {
    const expense = await db.expenses.get(id)
    if (expense) {
      const group = await db.groups.get(expense.groupId)
      if (group?.archived) throw new Error('Cannot modify an archived group')
      const updatedExpense = { ...expense, archived: true, updatedAt: now() }
      await db.expenses.update(id, { archived: true, updatedAt: updatedExpense.updatedAt })
      await appendActivity({ groupId: expense.groupId, entityType: 'expense', entityId: id, action: 'expense.archived', before: sanitizeActivitySnapshot(expense), after: sanitizeActivitySnapshot(updatedExpense) })
    }
  },

  /** Unarchive an expense (restores it to the active list). Throws if the group is archived. */
  async unarchiveExpense(id: string): Promise<void> {
    const expense = await db.expenses.get(id)
    if (expense) {
      const group = await db.groups.get(expense.groupId)
      if (group?.archived) throw new Error('Cannot modify an archived group')
      const updatedExpense = { ...expense, archived: false, updatedAt: now() }
      await db.expenses.update(id, { archived: false, updatedAt: updatedExpense.updatedAt })
      await appendActivity({ groupId: expense.groupId, entityType: 'expense', entityId: id, action: 'expense.unarchived', before: sanitizeActivitySnapshot(expense), after: sanitizeActivitySnapshot(updatedExpense) })
    }
  },

  /**
   * Archive all fully-settled expenses in a group.
   * An expense is settled when all members involved (payer + splitAmong) have a net balance of 0.
   * Returns the number of expenses that were archived.
   * Throws if the group is archived.
   */
  async archiveAllSettledExpenses(groupId: string): Promise<number> {
    const group = await db.groups.get(groupId)
    if (!group) return 0
    if (group.archived) throw new Error('Cannot modify an archived group')

    const memberIds = group.members.filter((m) => !m.deleted).map((m) => m.id)
    const expenses = await reparteix.listExpenses(groupId)
    const payments = await reparteix.listPayments(groupId)
    const balances = calculateBalances(memberIds, expenses, payments)

    const toArchive = expenses.filter((e) => !e.archived && isExpenseArchivable(e, balances))
    const timestamp = now()
    await Promise.all(
      toArchive.map((e) => db.expenses.update(e.id, { archived: true, updatedAt: timestamp })),
    )
    return toArchive.length
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

  /** Add a payment and return it. Throws if the group is archived. */
  async addPayment(
    payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>,
  ): Promise<Payment> {
    const group = await db.groups.get(payment.groupId)
    if (group?.archived) throw new Error('Cannot modify an archived group')
    const timestamp = now()
    const newPayment: Payment = {
      ...payment,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deleted: false,
    }
    await db.payments.add(newPayment)
    await appendActivity({ groupId: newPayment.groupId, entityType: 'payment', entityId: newPayment.id, action: 'payment.created', after: sanitizeActivitySnapshot(newPayment) })
    return newPayment
  },

  /** Update an existing payment. Throws if the group is archived. */
  async updatePayment(payment: Payment): Promise<Payment> {
    const group = await db.groups.get(payment.groupId)
    if (group?.archived) throw new Error('Cannot modify an archived group')
    const updated = { ...payment, updatedAt: now() }
    const existing = await db.payments.get(payment.id)
    await db.payments.update(payment.id, updated)
    await appendActivity({ groupId: payment.groupId, entityType: 'payment', entityId: payment.id, action: 'payment.updated', before: sanitizeActivitySnapshot(existing ?? payment), after: sanitizeActivitySnapshot(updated) })
    return updated
  },

  /** Soft-delete a payment. Throws if the group is archived. */
  async deletePayment(id: string): Promise<void> {
    const payment = await db.payments.get(id)
    if (payment) {
      const group = await db.groups.get(payment.groupId)
      if (group?.archived) throw new Error('Cannot modify an archived group')
      const updatedPayment = { ...payment, deleted: true, updatedAt: now() }
      await db.payments.update(id, { deleted: true, updatedAt: updatedPayment.updatedAt })
      await appendActivity({ groupId: payment.groupId, entityType: 'payment', entityId: id, action: 'payment.deleted', before: sanitizeActivitySnapshot(payment), after: sanitizeActivitySnapshot(updatedPayment) })
    }
  },

  // ─── Activity ──────────────────────────────────────────────────────

  async listActivity(groupId: string): Promise<ActivityEntry[]> {
    const entries = await db.activity
      .where('groupId')
      .equals(groupId)
      .toArray()

    return entries.sort((a, b) => {
      const byAt = b.at.localeCompare(a.at)
      if (byAt !== 0) return byAt
      return b.id.localeCompare(a.id)
    })
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

  /** Calculate netting result: naive vs minimized settlements with comparison stats. */
  async getNetting(groupId: string): Promise<NettingResult> {
    const balances = await reparteix.getBalances(groupId)
    return calculateNetting(balances)
  },

  // ─── Import / Export ───────────────────────────────────────────────

  /** Export a group and all its data as a versioned JSON object (ReparteixExportV1 envelope). */
  async exportGroup(groupId: string): Promise<ReparteixExportV1> {
    const group = await db.groups.get(groupId)
    if (!group) throw new Error(`Group not found: ${groupId}`)

    const expenses = await db.expenses
      .where('groupId')
      .equals(groupId)
      .toArray()

    const payments = await db.payments
      .where('groupId')
      .equals(groupId)
      .toArray()

    return {
      format: 'reparteix-export',
      version: 1,
      exportedAt: now(),
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined,
      data: {
        groups: [group],
        expenses,
        payments,
      },
    }
  },

  /**
   * Import group(s) from a file object. Supports:
   * - ReparteixExportV1 envelope (format: 'reparteix-export', version: 1)
   * - Legacy GroupExport format (schemaVersion: 1)
   * Validates with Zod before any writes.
   * Uses Last-Write-Wins (by updatedAt) for ID collisions.
   * The entire operation runs inside a Dexie transaction — no partial mutations.
   * Returns the first imported group (all groups are persisted).
   */
  async importGroup(raw: unknown): Promise<Group> {
    // Normalise to canonical internal model
    let groups: Group[]
    let expenses: Expense[]
    let payments: Payment[]

    const obj = raw as Record<string, unknown> | null | undefined
    if (obj && obj.format === 'reparteix-export') {
      // ── New envelope format ────────────────────────────────────────
      const envelope = ReparteixExportV1Schema.parse(raw)
      groups = envelope.data.groups
      expenses = envelope.data.expenses
      payments = envelope.data.payments
    } else {
      // ── Legacy format fallback ─────────────────────────────────────
      const data = GroupExportSchema.parse(raw)
      groups = [data.group]
      expenses = data.expenses
      payments = data.payments
    }

    await db.transaction('rw', [db.groups, db.expenses, db.payments], async () => {
      // ── Groups ─────────────────────────────────────────────────────
      for (const group of groups) {
        const existingGroup = await db.groups.get(group.id)
        if (
          !existingGroup ||
          existingGroup.updatedAt < group.updatedAt ||
          (existingGroup.deleted && !group.deleted)
        ) {
          await db.groups.put(group)
        }
      }

      // ── Expenses ───────────────────────────────────────────────────
      for (const expense of expenses) {
        const existing = await db.expenses.get(expense.id)
        if (!existing || existing.updatedAt < expense.updatedAt) {
          await db.expenses.put(expense)
        }
      }

      // ── Payments ───────────────────────────────────────────────────
      for (const payment of payments) {
        const existing = await db.payments.get(payment.id)
        if (!existing || existing.updatedAt < payment.updatedAt) {
          await db.payments.put(payment)
        }
      }
    })

    const result = await db.groups.get(groups[0].id)
    if (!result) throw new Error('Import failed: group not found after write')
    return result
  },

  // ─── Share ─────────────────────────────────────────────────────────

  share: {
    /**
     * Encode a group and all its data into a compressed, base64url-encoded share string.
     * The format is: `v1.<base64url(deflate-raw(JSON(SyncEnvelopeV1)))>`
     * Use the returned string as the `g` query parameter in an import URL.
     */
    async encodeGroup(groupId: string): Promise<string> {
      const group = await db.groups.get(groupId)
      if (!group) throw new Error(`Group not found: ${groupId}`)

      const expenses = await db.expenses.where('groupId').equals(groupId).toArray()
      const payments = await db.payments.where('groupId').equals(groupId).toArray()

      const envelope: SyncEnvelopeV1 = {
        version: 1,
        exportedAt: now(),
        group,
        expenses,
        payments,
      }

      const json = JSON.stringify(envelope)
      const compressed = await shareHelpers.compress(json)
      const encoded = shareHelpers.toBase64Url(compressed)
      return `v1.${encoded}`
    },

    /**
     * Decode a share string (as produced by `encodeGroup`) back into a validated SyncEnvelopeV1.
     * Throws if the format is invalid, the version is unsupported, or schema validation fails.
     */
    async decodeGroup(encoded: string): Promise<SyncEnvelopeV1> {
      if (!encoded.startsWith('v1.')) {
        throw new Error('Unsupported share format version')
      }
      const base64 = encoded.slice(3)
      const compressed = shareHelpers.fromBase64Url(base64)
      const json = await shareHelpers.decompress(compressed)
      const raw: unknown = JSON.parse(json)
      return SyncEnvelopeV1Schema.parse(raw)
    },
  },

  // ─── Sync ──────────────────────────────────────────────────────────

  sync: {
    /**
     * Apply an incoming sync envelope to the local database.
     * Validates with Zod, merges with LWW conflict resolution, checks referential integrity,
     * and persists all valid changes in a single Dexie transaction.
     * Returns a SyncReport summarising what was created, updated, skipped, conflicted or rejected.
     */
    async applyGroupJson(raw: unknown): Promise<SyncReport> {
      const envelope = SyncEnvelopeV1Schema.parse(raw)

      const localGroup = await db.groups.get(envelope.group.id)
      const localExpenses = localGroup
        ? await db.expenses.where('groupId').equals(envelope.group.id).toArray()
        : []
      const localPayments = localGroup
        ? await db.payments.where('groupId').equals(envelope.group.id).toArray()
        : []

      const decision = computeSyncMerge(envelope, localGroup, localExpenses, localPayments)

      await db.transaction('rw', [db.groups, db.expenses, db.payments], async () => {
        // ── Group + Members ─────────────────────────────────────────
        if (decision.groupAction !== 'conflict') {
          await db.groups.put(decision.mergedGroup)
        } else {
          // On conflict keep local metadata but persist merged members
          await db.groups.update(envelope.group.id, {
            members: decision.mergedGroup.members,
          })
        }

        // ── Expenses ────────────────────────────────────────────────
        for (const item of decision.expenses) {
          if (item.action === 'create' || item.action === 'update') {
            await db.expenses.put(item.expense)
          }
        }

        // ── Payments ────────────────────────────────────────────────
        for (const item of decision.payments) {
          if (item.action === 'create' || item.action === 'update') {
            await db.payments.put(item.payment)
          }
        }
      })

      return decision.report
    },

    /**
     * Preview the result of applying a sync envelope without persisting any changes.
     * Useful for showing the user what would change before confirming.
     * Returns the same SyncReport as applyGroupJson would, but performs no writes.
     */
    async previewGroupJson(raw: unknown): Promise<SyncReport> {
      const envelope = SyncEnvelopeV1Schema.parse(raw)

      const localGroup = await db.groups.get(envelope.group.id)
      const localExpenses = localGroup
        ? await db.expenses.where('groupId').equals(envelope.group.id).toArray()
        : []
      const localPayments = localGroup
        ? await db.payments.where('groupId').equals(envelope.group.id).toArray()
        : []

      const decision = computeSyncMerge(envelope, localGroup, localExpenses, localPayments)
      return decision.report
    },
  },
}
