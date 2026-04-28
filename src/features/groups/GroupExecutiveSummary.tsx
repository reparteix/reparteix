import { ReceiptText, CreditCard, Wallet, CalendarRange, Trophy, Activity } from 'lucide-react'
import type { Group } from '@/domain/entities'
import { calculateGroupExecutiveSummary } from '@/domain/services'
import { formatMoney } from '@/lib/number-format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStore } from '@/store'

interface GroupExecutiveSummaryProps {
  group: Group
}

const dateFormatter = new Intl.DateTimeFormat('ca-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'Encara no hi ha despeses'

  const startDate = new Date(start)
  const endDate = new Date(end)

  return `${dateFormatter.format(startDate)} → ${dateFormatter.format(endDate)}`
}

export function GroupExecutiveSummary({ group }: GroupExecutiveSummaryProps) {
  const { expenses, payments } = useStore()
  const activeMembers = group.members.filter((member) => !member.deleted)
  const memberById = new Map(activeMembers.map((member) => [member.id, member]))

  const summary = calculateGroupExecutiveSummary(
    activeMembers.map((member) => member.id),
    expenses,
    payments,
  )

  if (summary.expenseCount === 0 && summary.paymentCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resum del grup</CardTitle>
          <CardDescription>
            Quan comenceu a registrar despeses i pagaments, aquí hi veuràs el resum executiu del grup.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const topPayerByAmount = summary.topPayerByAmount
    ? memberById.get(summary.topPayerByAmount.memberId)
    : null

  const topPayerByCount = summary.topPayerByCount
    ? memberById.get(summary.topPayerByCount.memberId)
    : null

  const kpis = [
    {
      label: 'Total gastat',
      value: formatMoney(summary.totalExpenses, group.currency),
      icon: ReceiptText,
    },
    {
      label: 'Despeses',
      value: String(summary.expenseCount),
      icon: Activity,
    },
    {
      label: 'Pagaments',
      value: String(summary.paymentCount),
      icon: CreditCard,
    },
    {
      label: 'Mitjana per despesa',
      value: formatMoney(summary.averageExpense, group.currency),
      icon: Wallet,
    },
    {
      label: 'Saldo pendent',
      value: formatMoney(summary.outstandingBalanceTotal, group.currency),
      icon: Wallet,
    },
    {
      label: 'Període actiu',
      value: formatDateRange(summary.firstExpenseDate, summary.lastExpenseDate),
      icon: CalendarRange,
    },
  ]

  return (
    <div className="space-y-4 pb-4">
      <Card className="border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950">
        <CardHeader>
          <CardTitle>Resum executiu</CardTitle>
          <CardDescription>
            Una lectura ràpida del que ha passat al grup fins ara.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {kpis.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-background/80 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Qui ha avançat més
            </CardTitle>
            <CardDescription>
              Membre que més import ha pagat en despeses del grup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topPayerByAmount && summary.topPayerByAmount ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: topPayerByAmount.color }}
                  />
                  <span className="font-medium">{topPayerByAmount.name}</span>
                </div>
                <span className="font-semibold">
                  {formatMoney(summary.topPayerByAmount.value, group.currency)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Encara no hi ha prou dades.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Qui ha pagat més cops
            </CardTitle>
            <CardDescription>
              Membre amb més despeses registrades com a pagador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topPayerByCount && summary.topPayerByCount ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: topPayerByCount.color }}
                  />
                  <span className="font-medium">{topPayerByCount.name}</span>
                </div>
                <span className="font-semibold">
                  {summary.topPayerByCount.value} despesa{summary.topPayerByCount.value === 1 ? '' : 'es'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Encara no hi ha prou dades.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
