import type { ActivityEntry, Group } from '@/domain'

type Snapshot = Record<string, unknown>

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

function formatMoney(value: unknown, currency = 'EUR'): string | null {
  if (typeof value !== 'number') return null
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  return `${value.toFixed(2)} ${symbol}`
}

function formatValue(value: unknown, currency = 'EUR'): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return formatMoney(value, currency)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (Array.isArray(value)) return `${value.length} element${value.length === 1 ? '' : 's'}`
  return null
}

export function buildMemberMap(group: Group): Map<string, string> {
  return new Map(group.members.map((member) => [member.id, member.name]))
}

export function getMemberName(memberId: string, memberMap: Map<string, string>): string {
  return memberMap.get(memberId) ?? memberId
}

function formatMemberList(value: unknown, memberMap: Map<string, string>): string | null {
  if (!Array.isArray(value)) return null
  const names = value
    .filter((item): item is string => typeof item === 'string')
    .map((memberId) => getMemberName(memberId, memberMap))
  return names.length > 0 ? names.join(', ') : null
}

function getFieldLabel(field: string): string {
  switch (field) {
    case 'name':
      return 'Nom'
    case 'description':
      return 'Descripció'
    case 'icon':
      return 'Icona'
    case 'currency':
      return 'Moneda'
    case 'amount':
      return 'Import'
    case 'date':
      return 'Data'
    case 'payerId':
      return 'Pagador'
    case 'fromId':
      return 'De'
    case 'toId':
      return 'Cap a'
    case 'splitAmong':
      return 'Repartit entre'
    case 'archived':
      return 'Arxivat'
    case 'deleted':
      return 'Eliminat'
    default:
      return field
  }
}

export function getActivityDiffLines(entry: ActivityEntry, memberMap: Map<string, string>, currency = 'EUR'): string[] {
  if (!entry.before || !entry.after) return []

  const before = entry.before as Snapshot
  const after = entry.after as Snapshot
  const interestingFields = [
    'name',
    'description',
    'icon',
    'currency',
    'amount',
    'date',
    'payerId',
    'fromId',
    'toId',
    'splitAmong',
    'archived',
    'deleted',
  ]

  return interestingFields
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .flatMap((field) => {
      if (field === 'splitAmong') {
        const beforeIds = Array.isArray(before[field]) ? before[field].filter((item): item is string => typeof item === 'string') : []
        const afterIds = Array.isArray(after[field]) ? after[field].filter((item): item is string => typeof item === 'string') : []
        const added = afterIds.filter((id) => !beforeIds.includes(id)).map((id) => getMemberName(id, memberMap))
        const removed = beforeIds.filter((id) => !afterIds.includes(id)).map((id) => getMemberName(id, memberMap))
        const lines: string[] = []
        if (added.length > 0) lines.push(`Entren: ${added.join(', ')}`)
        if (removed.length > 0) lines.push(`Surten: ${removed.join(', ')}`)
        if (lines.length > 0) return lines
      }

      const rawBefore = before[field]
      const rawAfter = after[field]
      const beforeValue = field === 'payerId' || field === 'fromId' || field === 'toId'
        ? (typeof rawBefore === 'string' ? getMemberName(rawBefore, memberMap) : formatValue(rawBefore, currency))
        : field === 'splitAmong'
          ? formatMemberList(rawBefore, memberMap)
          : formatValue(rawBefore, currency)
      const afterValue = field === 'payerId' || field === 'fromId' || field === 'toId'
        ? (typeof rawAfter === 'string' ? getMemberName(rawAfter, memberMap) : formatValue(rawAfter, currency))
        : field === 'splitAmong'
          ? formatMemberList(rawAfter, memberMap)
          : formatValue(rawAfter, currency)
      return [`${getFieldLabel(field)}: ${beforeValue ?? 'buit'} → ${afterValue ?? 'buit'}`]
    })
}

export function formatActivityTimestamp(at: string): string {
  return new Date(at).toLocaleString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
