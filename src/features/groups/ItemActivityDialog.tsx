import type { ActivityEntry, Group } from '@/domain'
import { Badge } from '@/components/ui/badge'
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
import { buildMemberMap, formatActivityTimestamp, getActivityDiffLines } from './activity-utils'

interface ItemActivityDialogProps {
  group: Group
  title: string
  entries: ActivityEntry[]
  children: React.ReactNode
}

export function ItemActivityDialog({ group, title, entries, children }: ItemActivityDialogProps) {
  const memberMap = buildMemberMap(group)

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
            return (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge variant="outline">{entry.action.replace(/^.*\./, '')}</Badge>
                  <span className="text-xs text-muted-foreground">{formatActivityTimestamp(entry.at)}</span>
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
