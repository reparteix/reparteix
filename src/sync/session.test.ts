import { describe, expect, it } from 'vitest'
import { addExpenseToDoc, createGroupDoc, generateGroupKey, readGroupSnapshot } from './poc'
import { createSyncSession } from './session'
import { pairInMemoryTransport } from './transport'

async function waitFor(assertion: () => void, attempts = 20) {
  let lastError: unknown

  for (let index = 0; index < attempts; index += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  throw lastError
}

describe('sync session', () => {
  it('pushes encrypted updates between two peers through the transport layer', async () => {
    const groupKey = await generateGroupKey()
    const transport = pairInMemoryTransport([
      { peerId: 'a', remotePeerId: 'b' },
      { peerId: 'b', remotePeerId: 'a' },
    ])

    const source = createGroupDoc('Costa Brava')
    addExpenseToDoc(source, { id: 'e1', description: 'Gasolina', amount: 55 })
    const target = createGroupDoc()

    const sourceSession = createSyncSession(source, groupKey, transport.connect('a'))
    const targetSession = createSyncSession(target, groupKey, transport.connect('b'))
    sourceSession.start()
    targetSession.start()

    await sourceSession.pushState()

    await waitFor(() => {
      expect(readGroupSnapshot(target)).toEqual({
        title: 'Costa Brava',
        expenses: [{ id: 'e1', description: 'Gasolina', amount: 55 }],
      })
    })

    expect(targetSession.snapshot()).toEqual({
      title: 'Costa Brava',
      expenses: [{ id: 'e1', description: 'Gasolina', amount: 55 }],
    })
  })
})
