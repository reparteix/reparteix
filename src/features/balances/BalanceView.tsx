import { useMemo, useState } from 'react'
import { ArrowRight, Check, Share2, Sparkles, Wallet, CircleAlert } from 'lucide-react'
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
import { shareText } from '@/lib/web-share'

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
  const [recordedSettlementKey, setRecordedSettlementKey] = useState<string | null>(null)
  const [sharedSettlementKey, setSharedSettlementKey] = useState<string | null>(null)

  const activeMembers = group.members.filter((m) => !m.deleted)
  const memberIds = activeMembers.map((m) => m.id)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const balances = calculateBalances(memberIds, expenses, payments)
  const netting = calculateNetting(balances)

  const memberNameById = useMemo(
    () => new Map(group.members.map((member) => [member.id, member.name])),
    [group.members],
  )

  const getMemberName = (id: string) => memberNameById.get(id) ?? 'Desconegut'

  const totalExpenses = expenses
    .filter((e) => !e.deleted)
    .reduce((sum, e) => sum + e.amount, 0)

  const totalToSettle = netting.minimized.reduce((sum, settlement) => sum + settlement.amount, 0)

  const peopleToPay = new Set(netting.minimized.map((settlement) => settlement.fromId)).size

  const peopleToReceive = new Set(netting.minimized.map((settlement) => settlement.toId)).size

  const getSettlementKey = (fromId: string, toId: string, amount: number) => `${fromId}:${toId}:${amount.toFixed(2)}`

  const handleRecordPayment = async (fromId: string, toId: string, amount: number) => {
    const settlementKey = getSettlementKey(fromId, toId, amount)
    await addPayment({
      groupId: group.id,
      fromId,
      toId,
      amount,
      date: new Date().toISOString().split('T')[0],
    })
    setRecordedSettlementKey(settlementKey)
    setTimeout(() => setRecordedSettlementKey(null), 1500)
  }

  const buildShareMessage = (fromId: string, toId: string, amount: number) => {
    const debtor = getMemberName(fromId)
    const creditor = getMemberName(toId)
    return `Hola ${debtor}! Et toca pagar ${amount.toFixed(2)} ${symbol} a ${creditor} del grup "${group.name}" a Reparteix.`
  }

  const buildSettlementSummaryMessage = () => {
    if (netting.minimized.length === 0) {
      return `Grup "${group.name}": ara mateix no hi ha cap pagament pendent. Tot està equilibrat.`
    }

    const lines = netting.minimized.map((settlement) => {
      const debtor = getMemberName(settlement.fromId)
      const creditor = getMemberName(settlement.toId)
      return `• ${debtor} ha de pagar ${settlement.amount.toFixed(2)} ${symbol} a ${creditor}`
    })

    return [
      `Liquidació pendent del grup "${group.name}":`,
      '',
      ...lines,
      '',
      `Total a liquidar: ${totalToSettle.toFixed(2)} ${symbol}`,
    ].join('\n')
  }

  const handleShareReminder = async (fromId: string, toId: string, amount: number) => {
    const result = await shareText({
      title: `Recordatori de pagament · ${group.name}`,
      text: buildShareMessage(fromId, toId, amount),
    })
    if (result.method === 'cancelled') return
    setSharedSettlementKey(getSettlementKey(fromId, toId, amount))
    setTimeout(() => setSharedSettlementKey(null), 2000)
  }

  const handleShareSettlementSummary = async () => {
    await shareText({
      title: `Liquidació del grup · ${group.name}`,
      text: buildSettlementSummaryMessage(),
    })
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
      <div className="mb-4 space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">Liquidació suggerida</h3>
            {netting.minimized.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tot està equilibrat. No cal fer cap pagament ara mateix.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reparteix ha simplificat els saldos a {netting.minimized.length} pagament{netting.minimized.length === 1 ? '' : 's'} perquè liquidar sigui més ràpid i menys incòmode.
              </p>
            )}
          </div>
        </div>

        {netting.minimized.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-muted/40 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pagaments</p>
                  <p className="mt-1 text-xl font-semibold">{netting.minimized.length}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paguen</p>
                  <p className="mt-1 text-xl font-semibold">{peopleToPay}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cobren</p>
                  <p className="mt-1 text-xl font-semibold">{peopleToReceive}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
                  <p className="mt-1 text-xl font-semibold">{totalToSettle.toFixed(2)} {symbol}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleShareSettlementSummary}>
                  <Share2 className="h-4 w-4" />
                  Compartir liquidació completa
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {netting.minimized.length === 0 ? (
        <Card className="border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950">
          <CardContent className="flex items-center justify-center gap-2 p-4 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Tot està equilibrat! 🎉</span>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {netting.minimized.map((s) => {
            const settlementKey = getSettlementKey(s.fromId, s.toId, s.amount)

            return (
            <Card key={settlementKey} className="border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CircleAlert className="h-4 w-4" />
                      Acció suggerida
                    </div>
                    <div className="flex items-center gap-2 text-base sm:text-lg">
                      <span className="font-semibold">{getMemberName(s.fromId)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{getMemberName(s.toId)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getMemberName(s.fromId)} hauria de pagar <span className="font-medium text-foreground">{s.amount.toFixed(2)} {symbol}</span> a {getMemberName(s.toId)}.
                    </p>
                  </div>

                  <Badge variant="outline" className="w-fit border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-semibold text-sm px-3 py-1">
                    {s.amount.toFixed(2)} {symbol}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {sharedSettlementKey === settlementKey ? (
                    <span className="flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
                      <Check className="h-3 w-3" />
                      Recordatori compartit
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShareReminder(s.fromId, s.toId, s.amount)}
                      title="Compartir recordatori de pagament"
                      className="h-9"
                    >
                      <Share2 className="h-4 w-4" />
                      Compartir recordatori
                    </Button>
                  )}
                  {recordedSettlementKey === settlementKey ? (
                    <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                      <Check className="h-3 w-3" />
                      Pagament registrat
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleRecordPayment(s.fromId, s.toId, s.amount)}
                      title="Registrar aquest pagament"
                      className="h-9 bg-emerald-600 text-xs hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      <Check className="h-4 w-4" />
                      Marcar com pagat
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
