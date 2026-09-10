import { CalendarRange, CreditCard, ReceiptText, Wallet } from 'lucide-react'
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

function formatDate(date: string): string {
  return dateFormatter.format(new Date(date))
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'Sense període encara'
  if (start === end) return formatDate(start)
  return `${formatDate(start)} – ${formatDate(end)}`
}

function pluralizeExpense(count: number): string {
  return `${count} despesa${count === 1 ? '' : 'es'}`
}

export function GroupExecutiveSummary({ group }: GroupExecutiveSummaryProps) {
  const { expenses, payments } = useStore()
  const activeMembers = group.members.filter((member) => !member.deleted)
  const memberById = new Map(activeMembers.map((member) => [member.id, member]))

  const summary = calculateGroupExecutiveSummary(
    group.id,
    activeMembers.map((member) => member.id),
    expenses,
    payments,
  )

  if (summary.expenseCount === 0 && summary.paymentCount === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <CardHeader>
          <CardTitle>Resum del grup</CardTitle>
          <CardDescription>
            Encara no hi ha prou moviment. Quan afegiu despeses, aquí sortirà una lectura ràpida del grup.
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

  const statusText = summary.outstandingBalanceTotal > 0.01
    ? `Queden ${formatMoney(summary.outstandingBalanceTotal, group.currency)} per quadrar entre membres.`
    : 'El grup està quadrat: ara mateix no hi ha saldo pendent.'

  const detailRows = [
    {
      label: 'Moviment',
      value: `${pluralizeExpense(summary.expenseCount)} · ${summary.paymentCount} pagament${summary.paymentCount === 1 ? '' : 's'}`,
      icon: ReceiptText,
    },
    {
      label: 'Mitjana',
      value: `${formatMoney(summary.averageExpense, group.currency)} per despesa`,
      icon: Wallet,
    },
    {
      label: 'Període',
      value: formatDateRange(summary.firstExpenseDate, summary.lastExpenseDate),
      icon: CalendarRange,
    },
  ]

  const insights = [
    topPayerByAmount && summary.topPayerByAmount
      ? `${topPayerByAmount.name} és qui més ha avançat: ${formatMoney(summary.topPayerByAmount.value, group.currency)}.`
      : null,
    topPayerByCount && summary.topPayerByCount
      ? `${topPayerByCount.name} ha registrat més despeses: ${pluralizeExpense(summary.topPayerByCount.value)}.`
      : null,
  ].filter(Boolean)

  return (
    <div className="space-y-4 pb-4">
      <Card className="overflow-hidden shadow-none">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardDescription>Resum del grup</CardDescription>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {activeMembers.length} membre{activeMembers.length === 1 ? '' : 's'}
            </span>
          </div>
          <div>
            <CardTitle className="text-3xl leading-tight">
              {formatMoney(summary.totalExpenses, group.currency)}
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{statusText}</p>
          </div>
        </CardHeader>

        <CardContent className="space-y-1 pt-0">
          {detailRows.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between gap-4 border-t py-3 first:border-t-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              <div className="text-right text-sm font-medium">{value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {insights.length > 0 && (
        <Card className="bg-muted/30 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Lectura ràpida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {insights.map((insight) => (
              <p key={insight}>• {insight}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
