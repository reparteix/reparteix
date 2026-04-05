import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import type { Group } from '../../domain/entities'
import { useStore } from '../../store'
import {
  calculateBalances,
  calculateNetting,
} from '../../domain/services'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

interface BalanceViewProps {
  group: Group
}

export function BalanceView({ group }: BalanceViewProps) {
  const { expenses, payments, addPayment } = useStore()
  const [recordedIndex, setRecordedIndex] = useState<number | null>(null)

  const activeMembers = group.members.filter((m) => !m.deleted)
  const memberIds = activeMembers.map((m) => m.id)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const balances = calculateBalances(memberIds, expenses, payments)
  const netting = calculateNetting(balances)

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  const totalExpenses = expenses
    .filter((e) => !e.deleted)
    .reduce((sum, e) => sum + e.amount, 0)

  const handleRecordPayment = async (fromId: string, toId: string, amount: number, index: number) => {
    await addPayment({
      groupId: group.id,
      fromId,
      toId,
      amount,
      date: new Date().toISOString().split('T')[0],
    })
    setRecordedIndex(index)
    setTimeout(() => setRecordedIndex(null), 1500)
  }

  return (
    <div>
      {/* Summary */}
      <Card className="mb-6 border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950">
        <CardHeader className="pb-2">
          <CardDescription className="text-indigo-600 dark:text-indigo-400 font-medium">
            Total despeses
          </CardDescription>
          <CardTitle className="text-2xl text-indigo-800 dark:text-indigo-200">
            {totalExpenses.toFixed(2)} {symbol}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Balances */}
      <h3 className="font-semibold mb-3">Balanç per membre</h3>
      {activeMembers.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No hi ha membres al grup.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {balances.map((balance) => {
            const member = activeMembers.find((m) => m.id === balance.memberId)
            if (!member) return null
            return (
              <Card key={balance.memberId}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: member.color }}
                    />
                    <span className="font-medium">{member.name}</span>
                  </div>
                  <span
                    className={cn(
                      'font-semibold',
                      balance.total > 0 && 'text-green-600 dark:text-green-400',
                      balance.total < 0 && 'text-red-600 dark:text-red-400',
                      balance.total === 0 && 'text-muted-foreground',
                    )}
                  >
                    {balance.total > 0 ? '+' : ''}
                    {balance.total.toFixed(2)} {symbol}
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Separator className="my-6" />

      {/* Settlements */}
      <h3 className="font-semibold mb-3">Transferències suggerides</h3>
      {netting.minimized.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Tot està equilibrat! 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {netting.minimized.map((s, i) => (
            <Card key={i} className="border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{getMemberName(s.fromId)}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getMemberName(s.toId)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-semibold">
                    {s.amount.toFixed(2)} {symbol}
                  </Badge>
                  {recordedIndex === i ? (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="h-3 w-3" />
                      Fet!
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleRecordPayment(s.fromId, s.toId, s.amount, i)}
                      title="Registrar aquest pagament"
                      className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs h-7"
                    >
                      <Check className="h-3 w-3" />
                      Pagar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
