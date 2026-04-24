import { describe, expect, it } from 'vitest'
import type { ActivityEntry } from '@/domain'
import { getActivityOriginSummary } from './activity-utils'

function buildEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'entry-1',
    groupId: 'group-1',
    entityType: 'expense',
    entityId: 'expense-1',
    action: 'expense.updated',
    actor: 'local',
    at: '2026-04-24T18:00:00.000Z',
    ...overrides,
  }
}

describe('getActivityOriginSummary', () => {
  it('tradueix el dispositiu local a copy contextual', () => {
    const summary = getActivityOriginSummary(buildEntry({
      actor: 'Dispositiu abcd',
      meta: {
        deviceId: 'abcd-1234',
        deviceLabel: 'Dispositiu abcd',
      },
    }), 'abcd-1234')

    expect(summary).toMatchObject({
      label: 'Aquest dispositiu',
      detail: 'Dispositiu abcd',
      isLocal: true,
      isResolved: true,
    })
  })

  it('manté autoria remota amb pista tècnica curta', () => {
    const summary = getActivityOriginSummary(buildEntry({
      actor: 'Portàtil Edu',
      meta: {
        deviceId: 'f1e2-d3c4',
        deviceLabel: 'Portàtil Edu',
      },
    }))

    expect(summary).toMatchObject({
      label: 'Portàtil Edu',
      detail: 'id f1e2',
      isLocal: false,
      isResolved: true,
    })
  })

  it('deriva un fallback llegible si només hi ha deviceId', () => {
    const summary = getActivityOriginSummary(buildEntry({
      meta: {
        deviceId: '9988-7766',
      },
    }))

    expect(summary).toMatchObject({
      label: 'Dispositiu 9988',
      detail: 'id 9988',
      isResolved: true,
    })
  })

  it('fa fallback explícit quan no hi ha autoria resolta', () => {
    const summary = getActivityOriginSummary(buildEntry())

    expect(summary).toMatchObject({
      label: 'Origen no resolt',
      detail: null,
      isLocal: false,
      isResolved: false,
    })
  })
})
