import { useMemo, useState, useEffect } from 'react'
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Group, Payment, ActivityEntry } from '../../domain/entities'
import { useStore } from '../../store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { reparteix } from '@/sdk'
import { ItemActivityDialog } from '@/features/groups/ItemActivityDialog'

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

interface SettlementListProps {
  group: Group
}

export function SettlementList({ group }: SettlementListProps) {
  const { payments, addPayment, updatePayment, deletePayment } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])

  const activeMembers = group.members.filter((m) => !m.deleted)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  useEffect(() => {
    let cancelled = false
    const loadActivity = async () => {
      const entries = await reparteix.listActivity(group.id)
      if (!cancelled) setActivityEntries(entries)
    }
    void loadActivity()
    return () => {
      cancelled = true
    }
  }, [group.id, payments.length])

  const resetForm = () => {
    setEditingPaymentId(null)
    setFromId('')
    setToId('')
    setAmount('')
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromId || !toId || !amount || fromId === toId) return
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return

    if (editingPaymentId) {
      const existing = payments.find((payment) => payment.id === editingPaymentId)
      if (!existing) return
      await updatePayment({
        ...existing,
        fromId,
        toId,
        amount: amountNum,
      })
    } else {
      await addPayment({
        groupId: group.id,
        fromId,
        toId,
        amount: amountNum,
        date: new Date().toISOString().split('T')[0],
      })
    }

    resetForm()
  }

  const paymentActivity = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>()
    for (const entry of activityEntries) {
      if (entry.entityType !== 'payment' || !entry.action.endsWith('.updated')) continue
      const current = map.get(entry.entityId) ?? []
      current.push(entry)
      map.set(entry.entityId, current)
    }
    return map
  }, [activityEntries])

  const startEditing = (payment: Payment) => {
    setEditingPaymentId(payment.id)
    setFromId(payment.fromId)
    setToId(payment.toId)
    setAmount(payment.amount.toString())
    setShowForm(true)
  }

  return (
    <div>
      {activeMembers.length < 2 ? (
        <p className="text-muted-foreground text-center py-4">
          Afegeix almenys 2 membres per poder registrar pagaments.
        </p>
      ) : (
        <>
          {!showForm ? (
            !group.archived && (
              <Button
                onClick={() => setShowForm(true)}
                className="w-full mb-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nou pagament
              </Button>
            )
          ) : (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{editingPaymentId ? 'Editar pagament' : 'Nou pagament'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="from-member">Qui paga?</Label>
                    <Select value={fromId} onValueChange={setFromId}>
                      <SelectTrigger id="from-member">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="to-member">A qui?</Label>
                    <Select value={toId} onValueChange={setToId}>
                      <SelectTrigger id="to-member">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeMembers
                          .filter((m) => m.id !== fromId)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Import"
                      step="0.01"
                      min="0.01"
                      className="flex-1"
                      required
                    />
                    <span className="flex items-center text-muted-foreground">
                      {symbol}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      {editingPaymentId ? 'Guardar canvis' : 'Registrar pagament'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={resetForm}
                    >
                      Cancel·lar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Encara no hi ha pagaments registrats.
        </p>
      ) : (
        <div className="space-y-2">
          {[...payments]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((payment) => {
              const updates = paymentActivity.get(payment.id) ?? []
              const isEdited = updates.length > 0
              return (
              <Card key={payment.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="flex items-center gap-1">
                        {getMemberName(payment.fromId)}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        {getMemberName(payment.toId)}
                      </span>
                      {isEdited && (
                        <ItemActivityDialog
                          group={group}
                          title={`Canvis al pagament de ${getMemberName(payment.fromId)} a ${getMemberName(payment.toId)}`}
                          entries={updates}
                        >
                          <button type="button" className="inline-flex">
                            <Badge variant="secondary" className="cursor-pointer">editat</Badge>
                          </button>
                        </ItemActivityDialog>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {payment.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {payment.amount.toFixed(2)} {symbol}
                    </span>
                    {!group.archived && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => startEditing(payment)}
                        title="Editar pagament"
                        aria-label="Editar pagament"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      {!group.archived && (
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                      )}
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar pagament</AlertDialogTitle>
                          <AlertDialogDescription>
                            Estàs segur que vols eliminar aquest pagament de {getMemberName(payment.fromId)} a {getMemberName(payment.toId)}? Aquesta acció no es pot desfer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deletePayment(payment.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )})}
        </div>
      )}
    </div>
  )
}
