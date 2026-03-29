import { useState } from 'react'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import type { Group } from '../../domain/entities'
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

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

interface SettlementListProps {
  group: Group
}

export function SettlementList({ group }: SettlementListProps) {
  const { payments, addPayment, deletePayment } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')

  const activeMembers = group.members.filter((m) => !m.deleted)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromId || !toId || !amount || fromId === toId) return
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return

    await addPayment({
      groupId: group.id,
      fromId,
      toId,
      amount: amountNum,
      date: new Date().toISOString().split('T')[0],
    })

    setFromId('')
    setToId('')
    setAmount('')
    setShowForm(false)
  }

  return (
    <div>
      {activeMembers.length < 2 ? (
        <p className="text-gray-500 text-center py-4">
          Afegeix almenys 2 membres per poder registrar pagaments.
        </p>
      ) : (
        <>
          {!showForm ? (
            <Button
              onClick={() => setShowForm(true)}
              className="w-full mb-4 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nou pagament
            </Button>
          ) : (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Nou pagament</CardTitle>
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
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      Registrar pagament
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowForm(false)}
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
        <p className="text-gray-500 text-center py-4">
          Encara no hi ha pagaments registrats.
        </p>
      ) : (
        <div className="space-y-2">
          {[...payments]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((payment) => (
              <Card key={payment.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1 font-medium">
                      {getMemberName(payment.fromId)}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      {getMemberName(payment.toId)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {payment.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-semibold text-emerald-600">
                      {payment.amount.toFixed(2)} {symbol}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
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
                    </AlertDialog>                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
