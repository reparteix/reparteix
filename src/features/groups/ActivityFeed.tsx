import { useEffect, useMemo, useState } from 'react'
import { Receipt, ArrowRightLeft, Users, FolderKanban } from 'lucide-react'
import type { ActivityEntry, Group } from '@/domain'
import { reparteix } from '@/sdk'
import { Card, CardContent } from '@/components/ui/card'

type Snapshot = Record<string, unknown>

function formatRelative(at: string): string {
  const diffMs = Date.now() - new Date(at).getTime()
  const diffMin = Math.round(diffMs / 60000)

  if (diffMin < 1) return 'ara mateix'
  if (diffMin < 60) return `fa ${diffMin} min`

  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `fa ${diffHours} h`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `fa ${diffDays} d`

  return new Date(at).toLocaleString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(value: unknown): string | null {
  if (typeof value !== 'number') return null
  return `${value.toFixed(2)} €`
}

function formatValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return formatMoney(value)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (Array.isArray(value)) return `${value.length} element${value.length === 1 ? '' : 's'}`
  return null
}

function getMemberName(memberId: string, memberMap: Map<string, string>): string {
  return memberMap.get(memberId) ?? memberId
}

function formatMemberList(value: unknown, memberMap: Map<string, string>): string | null {
  if (!Array.isArray(value)) return null
  const names = value
    .filter((item): item is string => typeof item === 'string')
    .map((memberId) => getMemberName(memberId, memberMap))
  return names.length > 0 ? names.join(', ') : null
}

function getIcon(entry: ActivityEntry) {
  switch (entry.entityType) {
    case 'expense':
      return <Receipt className="h-4 w-4" />
    case 'payment':
      return <ArrowRightLeft className="h-4 w-4" />
    case 'member':
      return <Users className="h-4 w-4" />
    default:
      return <FolderKanban className="h-4 w-4" />
  }
}

function getTitle(entry: ActivityEntry): string {
  switch (entry.action) {
    case 'group.created':
      return 'Grup creat'
    case 'group.updated':
      return 'Grup actualitzat'
    case 'group.archived':
      return 'Grup arxivat'
    case 'group.unarchived':
      return 'Grup desarxivat'
    case 'group.deleted':
      return 'Grup eliminat'
    case 'member.added':
      return 'Membre afegit'
    case 'member.renamed':
      return 'Membre reanomenat'
    case 'member.removed':
      return 'Membre eliminat'
    case 'expense.created':
      return 'Despesa creada'
    case 'expense.updated':
      return 'Despesa actualitzada'
    case 'expense.deleted':
      return 'Despesa eliminada'
    case 'expense.archived':
      return 'Despesa arxivada'
    case 'expense.unarchived':
      return 'Despesa desarxivada'
    case 'payment.created':
      return 'Pagament creat'
    case 'payment.updated':
      return 'Pagament actualitzat'
    case 'payment.deleted':
      return 'Pagament eliminat'
    default:
      return 'Canvi registrat'
  }
}

function getHeadline(entry: ActivityEntry): string | null {
  if (entry.entityType === 'member') {
    const meta = entry.meta as { memberName?: string, fromName?: string, toName?: string } | undefined
    if (entry.action === 'member.renamed' && meta?.fromName && meta?.toName) {
      return `${meta.fromName} → ${meta.toName}`
    }
    return meta?.memberName ?? null
  }

  if (entry.entityType === 'expense') {
    const after = entry.after as { description?: string, amount?: number } | undefined
    const before = entry.before as { description?: string, amount?: number } | undefined
    const snapshot = after ?? before
    if (!snapshot) return null
    const amount = typeof snapshot.amount === 'number' ? ` · ${snapshot.amount.toFixed(2)} €` : ''
    return `${snapshot.description ?? 'Despesa'}${amount}`
  }

  if (entry.entityType === 'payment') {
    const after = entry.after as { amount?: number } | undefined
    const before = entry.before as { amount?: number } | undefined
    const snapshot = after ?? before
    if (!snapshot || typeof snapshot.amount !== 'number') return 'Pagament'
    return `${snapshot.amount.toFixed(2)} €`
  }

  const after = entry.after as { name?: string } | undefined
  const before = entry.before as { name?: string } | undefined
  return after?.name ?? before?.name ?? null
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

function getDiffLines(entry: ActivityEntry, memberMap: Map<string, string>): string[] {
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
        ? (typeof rawBefore === 'string' ? getMemberName(rawBefore, memberMap) : formatValue(rawBefore))
        : field === 'splitAmong'
          ? formatMemberList(rawBefore, memberMap)
          : formatValue(rawBefore)
      const afterValue = field === 'payerId' || field === 'fromId' || field === 'toId'
        ? (typeof rawAfter === 'string' ? getMemberName(rawAfter, memberMap) : formatValue(rawAfter))
        : field === 'splitAmong'
          ? formatMemberList(rawAfter, memberMap)
          : formatValue(rawAfter)
      return [`${getFieldLabel(field)}: ${beforeValue ?? 'buit'} → ${afterValue ?? 'buit'}`]
    })
}

export function ActivityFeed({ groupId, group }: { groupId: string, group: Group }) {
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      const entries = await reparteix.listActivity(groupId)
      if (!cancelled) {
        setActivity(entries)
        setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [groupId])

  const memberMap = useMemo(
    () => new Map(group.members.map((member) => [member.id, member.name])),
    [group.members],
  )

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregant historial...</p>
  }

  if (activity.length === 0) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Encara no hi ha activitat registrada en aquest grup.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {activity.map((entry) => {
        const headline = getHeadline(entry)
        const diffLines = entry.action.endsWith('.updated') ? getDiffLines(entry, memberMap) : []

        return (
          <Card key={entry.id}>
            <CardContent className="flex items-start gap-3 pt-6">
              <div className="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">
                {getIcon(entry)}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{getTitle(entry)}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(entry.at)}</span>
                </div>
                {headline && (
                  <p className="text-sm text-muted-foreground break-words">{headline}</p>
                )}
                {diffLines.length > 0 && (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {diffLines.map((line) => (
                      <li key={line} className="break-words">• {line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
