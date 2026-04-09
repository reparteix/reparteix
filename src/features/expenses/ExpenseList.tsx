import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Camera, ImagePlus, X, Archive, ArchiveRestore, Pencil } from 'lucide-react'
import type { Group, Expense } from '../../domain/entities'
import { computeExpenseShares, calculateBalances, isExpenseArchivable } from '../../domain/services/balances'
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

interface ExpenseListProps {
  group: Group
}

export function ExpenseList({ group }: ExpenseListProps) {
  const { expenses, payments, addExpense, updateExpense, deleteExpense, archiveAllSettledExpenses, unarchiveExpense } = useStore()
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState('')
  const [splitAmong, setSplitAmong] = useState<string[]>([])
  const [splitType, setSplitType] = useState<'equal' | 'proportional' | 'fixed'>('equal')
  const [proportions, setProportions] = useState<Record<string, string>>({})
  const [fixedAmounts, setFixedAmounts] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (viewingReceipt) {
      modalRef.current?.focus()
    }
  }, [viewingReceipt])

  const activeMembers = group.members.filter((m) => !m.deleted)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const memberIds = activeMembers.map((m) => m.id)
  const balances = calculateBalances(memberIds, expenses, payments)

  const activeExpenses = expenses.filter((e) => !e.archived)
  const archivedExpenses = expenses.filter((e) => e.archived)
  const visibleExpenses = showArchived ? archivedExpenses : activeExpenses
  const archivableCount = activeExpenses.filter((e) => isExpenseArchivable(e, balances)).length

  const resetForm = () => {
    setEditingExpenseId(null)
    setDescription('')
    setAmount('')
    setPayerId('')
    setSplitAmong([])
    setSplitType('equal')
    setProportions({})
    setFixedAmounts({})
    setReceiptImage(null)
    setReceiptError(null)
    setShowForm(false)
  }

  const buildCurrentSplitFields = () => ({
    splitType,
    splitProportions:
      splitType === 'proportional'
        ? Object.fromEntries(
            splitAmong.map((id) => [id, parseFloat(proportions[id] ?? '1') || 1]),
          )
        : undefined,
    splitFixedAmounts:
      splitType === 'fixed'
        ? Object.fromEntries(
            splitAmong.map((id) => [id, parseFloat(fixedAmounts[id] ?? '0') || 0]),
          )
        : undefined,
  })

  const startCreate = () => {
    resetForm()
    setShowForm(true)
    setSplitAmong(activeMembers.map((m) => m.id))
  }

  const startEdit = (expense: Expense) => {
    setEditingExpenseId(expense.id)
    setDescription(expense.description)
    setAmount(expense.amount.toString())
    setPayerId(expense.payerId)
    setSplitAmong(expense.splitAmong)
    setSplitType(expense.splitType ?? 'equal')
    setProportions(
      Object.fromEntries(
        expense.splitAmong.map((id) => [id, String(expense.splitProportions?.[id] ?? 1)]),
      ),
    )
    setFixedAmounts(
      Object.fromEntries(
        expense.splitAmong.map((id) => [id, String(expense.splitFixedAmounts?.[id] ?? '')]),
      ),
    )
    setReceiptImage(expense.receiptImage ?? null)
    setReceiptError(null)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount || !payerId || splitAmong.length === 0) return
    if (validationError) return

    const numAmount = parseFloat(amount)
    const splitFields = buildCurrentSplitFields()
    const baseExpense = {
      groupId: group.id,
      description: description.trim(),
      amount: numAmount,
      payerId,
      splitAmong,
      ...splitFields,
      date: new Date().toISOString().split('T')[0],
      receiptImage: receiptImage ?? undefined,
    }

    const computedShares = computeExpenseShares({
      ...baseExpense,
      id: editingExpenseId ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      deleted: false,
    } as Expense)

    if (editingExpenseId) {
      const existing = expenses.find((expense) => expense.id === editingExpenseId)
      if (!existing) return
      await updateExpense({
        ...existing,
        ...baseExpense,
        date: existing.date,
        computedShares,
      })
    } else {
      await addExpense({ ...baseExpense, computedShares })
    }

    resetForm()
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

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  const getMemberColor = (id: string) =>
    group.members.find((m) => m.id === id)?.color ?? '#6366f1'

  let validationError: string | null = null
  if (splitType === 'fixed' && splitAmong.length > 0 && amount) {
    const total = parseFloat(amount) || 0
    const sum = splitAmong.reduce(
      (s, id) => s + (parseFloat(fixedAmounts[id] ?? '0') || 0),
      0,
    )
    if (sum > total + 0.01) {
      validationError = `Els imports fixos (${sum.toFixed(2)} ${symbol}) superen el total (${total.toFixed(2)} ${symbol}).`
    } else if (Math.abs(sum - total) > 0.01) {
      validationError = `Els imports fixos han de sumar el total (${total.toFixed(2)} ${symbol}). Ara sumen ${sum.toFixed(2)} ${symbol}.`
    }
  }

  const numAmountPreview = parseFloat(amount)
  const previewShares: Record<string, number> | null =
    numAmountPreview > 0 && splitAmong.length > 0
      ? computeExpenseShares({
          id: editingExpenseId ?? '',
          groupId: group.id,
          description: '',
          amount: numAmountPreview,
          payerId: payerId || '',
          splitAmong,
          ...buildCurrentSplitFields(),
          date: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archived: false,
          deleted: false,
        } as Expense)
      : null

  const getSplitLabel = (expense: Expense) => {
    if (expense.splitType === 'proportional' && expense.splitProportions) {
      const total = expense.splitAmong.reduce(
        (sum, id) => sum + (expense.splitProportions![id] ?? 1),
        0,
      )
      return (
        'Proporcional: ' +
        expense.splitAmong
          .map((id) => {
            const w = expense.splitProportions![id] ?? 1
            const pct = total > 0 ? ((w / total) * 100).toFixed(0) : '0'
            return `${getMemberName(id)} (${pct}%)`
          })
          .join(', ')
      )
    }
    if (expense.splitType === 'fixed' && expense.splitFixedAmounts) {
      return (
        'Imports fixos: ' +
        expense.splitAmong
          .map((id) => `${getMemberName(id)} (${(expense.splitFixedAmounts![id] ?? 0).toFixed(2)} ${symbol})`)
          .join(', ')
      )
    }
    return `Repartit entre: ${expense.splitAmong.map(getMemberName).join(', ')}`
  }

  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('ca-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const expensesByDay = (() => {
    const sorted = [...visibleExpenses].sort((a, b) => b.date.localeCompare(a.date))
    const groups: { date: string; items: Expense[] }[] = []
    for (const expense of sorted) {
      const last = groups[groups.length - 1]
      if (last && last.date === expense.date) {
        last.items.push(expense)
      } else {
        groups.push({ date: expense.date, items: [expense] })
      }
    }
    return groups
  })()

  return (
    <div>
      {activeMembers.length < 2 ? (
        <p className="text-muted-foreground text-center py-4">
          Afegeix almenys 2 membres per poder crear despeses.
        </p>
      ) : (
        <>
          {!showForm ? (
            <div className="flex gap-2 mb-4">
              {!group.archived && (
                <Button
                  onClick={startCreate}
                  className="flex-1"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova despesa
                </Button>
              )}
              {!group.archived && !showArchived && archivableCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => archiveAllSettledExpenses(group.id)}
                  title="Arxivar totes les despeses saldades"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arxivar saldades ({archivableCount})
                </Button>
              )}
              {archivedExpenses.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowArchived((v) => !v)}
                  title={showArchived ? 'Mostrar actives' : 'Mostrar arxivades'}
                >
                  {showArchived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Actives
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Arxivades ({archivedExpenses.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">{editingExpenseId ? 'Editar despesa' : 'Nova despesa'}</CardTitle>
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
                    <Label>Com es reparteix?</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={splitType === 'equal' ? 'default' : 'outline'}
                        onClick={() => setSplitType('equal')}
                      >
                        Per parts iguals
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={splitType === 'proportional' ? 'default' : 'outline'}
                        onClick={() => setSplitType('proportional')}
                      >
                        Proporcional
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={splitType === 'fixed' ? 'default' : 'outline'}
                        onClick={() => setSplitType('fixed')}
                      >
                        Imports fixos
                      </Button>
                    </div>
                  </div>
                  {splitType === 'proportional' && splitAmong.length > 0 && (() => {
                    const totalWeight = splitAmong.reduce(
                      (s, id) => s + (parseFloat(proportions[id] ?? '1') || 1),
                      0,
                    )
                    return (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          Proporcions (parts relatives)
                        </Label>
                        {splitAmong.map((id) => {
                          const w = parseFloat(proportions[id] ?? '1') || 1
                          const pct = totalWeight > 0 ? ((w / totalWeight) * 100).toFixed(1) : '0.0'
                          return (
                            <div key={id} className="flex items-center gap-2">
                              <span className="text-sm w-24 truncate">{getMemberName(id)}</span>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={proportions[id] ?? '1'}
                                onChange={(e) =>
                                  setProportions((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                                className="w-24"
                              />
                              <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                                {pct}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  {splitType === 'fixed' && splitAmong.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground">
                          Imports fixos ({symbol})
                        </Label>
                        <span className={cn(
                          'text-xs font-medium',
                          amount && Math.abs(splitAmong.reduce((s, id) => s + (parseFloat(fixedAmounts[id] ?? '0') || 0), 0) - (parseFloat(amount) || 0)) <= 0.01
                            ? 'text-success'
                            : 'text-destructive',
                        )}>
                          {splitAmong.reduce((s, id) => s + (parseFloat(fixedAmounts[id] ?? '0') || 0), 0).toFixed(2)} / {(parseFloat(amount) || 0).toFixed(2)} {symbol}
                        </span>
                      </div>
                      {splitAmong.map((id) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="text-sm w-24 truncate">{getMemberName(id)}</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={fixedAmounts[id] ?? ''}
                            placeholder="0.00"
                            onChange={(e) =>
                              setFixedAmounts((prev) => ({
                                ...prev,
                                [id]: e.target.value,
                              }))
                            }
                            className="w-28"
                          />
                          <span className="text-sm text-muted-foreground">{symbol}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {validationError && (
                    <p className="text-xs text-destructive">{validationError}</p>
                  )}
                  {previewShares && splitAmong.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">
                        Preview del repartiment
                      </Label>
                      <div className="rounded-md border p-2 space-y-1 bg-muted/30">
                        {splitAmong.map((id) => {
                          const share = previewShares[id] ?? 0
                          return (
                            <div key={id} className="flex justify-between text-sm">
                              <span>{getMemberName(id)}</span>
                              <span className="font-medium tabular-nums">
                                {share.toFixed(2)} {symbol}
                              </span>
                            </div>
                          )
                        })}
                        <div className="flex justify-between text-xs text-muted-foreground border-t pt-1 mt-1">
                          <span>Total</span>
                          <span className="tabular-nums">
                            {Object.values(previewShares).reduce((s, v) => s + v, 0).toFixed(2)} {symbol}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Foto del tiquet</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {receiptImage ? (
                      <div className="relative w-fit">
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
                          className="absolute top-1 right-1 bg-card rounded-full p-0.5 shadow hover:bg-muted"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImagePlus className="mr-2 h-4 w-4" />
                          Afegir foto
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Fer foto
                        </Button>
                      </div>
                    )}
                    {receiptError && (
                      <p className="text-xs text-destructive mt-1">{receiptError}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={!!validationError}>
                      {editingExpenseId ? 'Guardar canvis' : 'Afegir despesa'}
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

      {visibleExpenses.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          {showArchived ? 'No hi ha despeses arxivades.' : 'Encara no hi ha despeses.'}
        </p>
      ) : (
        <div className="space-y-4">
          {expensesByDay.map(({ date, items }) => (
            <div key={date}>
              <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-1 pb-1 pt-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">
                  {formatDate(date)}
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  {items.reduce((s, e) => s + e.amount, 0).toFixed(2)} {symbol}
                </div>
              </div>
              <div className="space-y-2">
                {items.map((expense) => {
                  const splitLabel = getSplitLabel(expense)
                  return (
                    <Card key={expense.id} className={cn(showArchived && 'opacity-75')}>
                      <CardContent className="flex items-center justify-between p-3">
                        <div className="flex-1">
                          <div className="font-medium">{expense.description}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: getMemberColor(expense.payerId) }}
                            />
                            {getMemberName(expense.payerId)} ha pagat
                          </div>
                          <div className="text-xs text-muted-foreground/70">
                            {splitLabel}
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
                                className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Camera className="h-3 w-3" />
                              </Button>
                            )}
                            {!showArchived && !group.archived && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(expense)}
                                className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Editar
                              </Button>
                            )}
                            {showArchived ? (
                              !group.archived && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => unarchiveExpense(expense.id)}
                                  className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <ArchiveRestore className="mr-1 h-3 w-3" />
                                  Desarxivar
                                </Button>
                              )
                            ) : (
                              <AlertDialog>
                                {!group.archived && (
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="mr-1 h-3 w-3" />
                                      Eliminar
                                    </Button>
                                  </AlertDialogTrigger>
                                )}
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminar despesa</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Estàs segur que vols eliminar la despesa &quot;{expense.description}&quot;? Aquesta acció no es pot desfer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteExpense(expense.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
          {visibleExpenses.length > 0 && (
            <div className="flex items-center justify-between px-3 pt-1 text-sm font-medium text-muted-foreground">
              <span>Total ({visibleExpenses.length} despeses)</span>
              <span>
                {visibleExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)} {symbol}
              </span>
            </div>
          )}
        </div>
      )}

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
              className="absolute top-2 right-2 bg-card rounded-full p-1 shadow hover:bg-muted"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
