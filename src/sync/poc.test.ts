import { describe, expect, it } from 'vitest'
import {
  addExpenseToDoc,
  applyEncryptedUpdate,
  createGroupDoc,
  createInvitePayload,
  debugSnapshot,
  exportEncryptedUpdate,
  generateGroupKey,
  readGroupSnapshot,
  readInvitePayload,
} from './poc'

describe('sync poc', () => {
  it('syncs an encrypted group snapshot between two docs', async () => {
    const groupKey = await generateGroupKey()
    const source = createGroupDoc('Girona trip')
    addExpenseToDoc(source, { id: 'e1', description: 'Sopar', amount: 42 })

    const envelope = await exportEncryptedUpdate(source, groupKey)
    const target = createGroupDoc()
    await applyEncryptedUpdate(target, envelope, groupKey)

    expect(readGroupSnapshot(target)).toEqual({
      title: 'Girona trip',
      expenses: [{ id: 'e1', description: 'Sopar', amount: 42 }],
    })
  })

  it('creates a shareable invite payload with the group key', async () => {
    const groupKey = await generateGroupKey()
    const payload = await createInvitePayload(groupKey, 'group-123')
    const invite = await readInvitePayload(payload)

    expect(invite.groupId).toBe('group-123')
    expect(Array.from(invite.groupKey)).toEqual(Array.from(groupKey))
  })

  it('renders a human-readable debug snapshot', () => {
    const text = debugSnapshot({
      title: 'Casa',
      expenses: [{ id: 'e1', description: 'Compra', amount: 18 }],
    })

    expect(text).toBe('Casa: Compra(18)')
  })
})
