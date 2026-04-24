import type { ActivityEntry, Group } from '@/domain'
import { Badge } from '@/components/ui/badge'
import { getLocalDeviceIdentity } from '@/lib/device-identity'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { buildMemberMap, formatActivityTimestamp, getActivityDiffLines, getActivityOriginSummary } from './activity-utils'

interface ItemActivityDialogProps {
  group: Group
  title: string
  entries: ActivityEntry[]
  children: React.ReactNode
}

export function ItemActivityDialog({ group, title, entries, children }: ItemActivityDialogProps) {
  const memberMap = buildMemberMap(group)
  const localDeviceId = (() => {
    try {
      return getLocalDeviceIdentity().deviceId
    } catch {
      return undefined
    }
  })()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Historial de canvis registrats per aquest element.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {entries.map((entry) => {
            const diffLines = getActivityDiffLines(entry, memberMap, group.currency)
            const origin = getActivityOriginSummary(entry, localDeviceId)
            return (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge variant="outline">{entry.action.replace(/^.*\./, '')}</Badge>
                  <span className="text-xs text-muted-foreground">{formatActivityTimestamp(entry.at)}</span>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Origen: <span className="font-medium text-foreground">{origin.label}</span></span>
                  {origin.detail && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {origin.detail}
                    </span>
                  )}
                </div>
                {diffLines.length > 0 ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {diffLines.map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No hi ha detall addicional per aquest canvi.</p>
                )}
              </div>
            )
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogAction>D'acord</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
