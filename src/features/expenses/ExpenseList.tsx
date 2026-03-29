import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Camera, X } from 'lucide-react'
import type { Group } from '../../domain/entities'
import { useStore } from '../../store'
import { cn } from '@/lib/utils'
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

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

interface ExpenseListProps {
  group: Group
}

export function ExpenseList({ group }: ExpenseListProps) {
  const { expenses, addExpense, deleteExpense } = useStore()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState('')
  const [splitAmong, setSplitAmong] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus modal when it opens
  useEffect(() => {
    if (viewingReceipt) {
      modalRef.current?.focus()
    }
  }, [viewingReceipt])

  const activeMembers = group.members.filter((m) => !m.deleted)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount || !payerId || splitAmong.length === 0) return

    await addExpense({
      groupId: group.id,
      description: description.trim(),
      amount: parseFloat(amount),
      payerId,
      splitAmong,
      date: new Date().toISOString().split('T')[0],
      receiptImage: receiptImage ?? undefined,
    })

    setDescription('')
    setAmount('')
    setPayerId('')
    setSplitAmong([])
    setReceiptImage(null)
    setReceiptError(null)
    setShowForm(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const input = e.target
    const resetInput = () => { input.value = '' }
    if (!file) return

    setReceiptError(null)

    if (!file.type.startsWith('image/')) {
      setReceiptError('El fitxer seleccionat no és una imatge vàlida.')
      resetInput()
      return
    }

    const MAX_SIZE_MB = 5
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setReceiptError(`La imatge no pot superar ${MAX_SIZE_MB} MB.`)
      resetInput()
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setReceiptImage(reader.result as string)
      resetInput()
    }
    reader.onerror = () => {
      setReceiptError("No s'ha pogut carregar la imatge. Torna-ho a intentar.")
      resetInput()
    }
    reader.readAsDataURL(file)
  }

  const toggleSplitMember = (memberId: string) => {
    setSplitAmong((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    )
  }

  const selectAllMembers = () => {
    setSplitAmong(activeMembers.map((m) => m.id))
  }

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  return (
    <div>
      {activeMembers.length < 2 ? (
        <p className="text-muted-foreground text-center py-4">
          Afegeix almenys 2 membres per poder crear despeses.
        </p>
      ) : (
        <>
          {!showForm ? (
            <Button
              onClick={() => {
                setShowForm(true)
                selectAllMembers()
              }}
              className="w-full mb-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova despesa
            </Button>
          ) : (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Nova despesa</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <Input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descripció (p.ex. Sopar)"
                      required
                    />
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
                  <div className="space-y-1">
                    <Label>Qui ha pagat?</Label>
                    <Select value={payerId} onValueChange={setPayerId}>
                      <SelectTrigger className="w-full">
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
                    <Label>Repartir entre:</Label>
                    <div className="flex flex-wrap gap-2">
                      {activeMembers.map((m) => (
                        <Button
                          key={m.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggleSplitMember(m.id)}
                          className={cn(
                            'rounded-full',
                            splitAmong.includes(m.id) &&
                              'bg-primary text-primary-foreground hover:bg-primary/90',
                          )}
                        >
                          {m.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Foto del tiquet</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {receiptImage ? (
                      <div className="relative inline-block">
                        <img
                          src={receiptImage}
                          alt="Tiquet"
                          className="max-h-[200px] rounded-md border object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptImage(null)
                            setReceiptError(null)
                          }}
                          aria-label="Eliminar foto"
                          className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow hover:bg-gray-100"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Afegir foto
                      </Button>
                    )}
                    {receiptError && (
                      <p className="text-xs text-red-500 mt-1">{receiptError}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      Afegir despesa
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowForm(false)
                        setReceiptImage(null)
                        setReceiptError(null)
                      }}
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

      {expenses.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Encara no hi ha despeses.
        </p>
      ) : (
        <div className="space-y-2">
          {expenses
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((expense) => (
              <Card key={expense.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex-1">
                    <div className="font-medium">{expense.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {getMemberName(expense.payerId)} ha pagat · {expense.date}
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      Repartit entre: {expense.splitAmong.map(getMemberName).join(', ')}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex flex-col items-end gap-1">
                    <div className="font-semibold">
                      {expense.amount.toFixed(2)} {symbol}
                    </div>
                    <div className="flex items-center gap-1">
                      {expense.receiptImage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingReceipt(expense.receiptImage ?? null)}
                          aria-label="Veure tiquet"
                          className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-indigo-600"
                        >
                          <Camera className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExpense(expense.id)}
                        className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Receipt viewer modal */}
      {viewingReceipt && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label="Visor del tiquet"
          tabIndex={-1}
          onClick={() => setViewingReceipt(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setViewingReceipt(null)
            }
          }}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewingReceipt}
              alt="Tiquet"
              className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-lg"
            />
            <button
              type="button"
              onClick={() => setViewingReceipt(null)}
              aria-label="Tancar"
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
