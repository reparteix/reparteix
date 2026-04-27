import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Shield, Sparkles, Users, X } from 'lucide-react'
import { useStore } from '../../store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatMoney, parseLocaleNumber } from '@/lib/number-format'

type Step = 1 | 2 | 3

interface DraftState {
  step: Step
  groupId: string | null
  groupName: string
  memberNames: string[]
  expenseDescription: string
  expenseAmount: string
  payerIndex: string
}

const STORAGE_KEY = 'reparteix:onboarding-draft:v1'
export const ONBOARDING_COMPLETED_KEY = 'reparteix:onboarding-completed:v1'

const DEFAULT_DRAFT: DraftState = {
  step: 1,
  groupId: null,
  groupName: '',
  memberNames: ['Tu', 'Anna', 'Bernat'],
  expenseDescription: 'Sopar',
  expenseAmount: '36',
  payerIndex: '0',
}

export function OnboardingWizard() {
  const navigate = useNavigate()
  const { groups, addGroup, addMember, addExpense, loadGroups } = useStore()
  const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT)
  const [isReady, setIsReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(stored) })
      }
    } catch {
      // ignore draft load failures
    } finally {
      setIsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!isReady) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch {
      // ignore draft save failures
    }
  }, [draft, isReady])

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === draft.groupId),
    [groups, draft.groupId],
  )

  const members = activeGroup?.members.filter((member) => !member.deleted) ?? []

  const setStep = (step: Step) => setDraft((current) => ({ ...current, step }))

  const updateMemberName = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      memberNames: current.memberNames.map((name, i) => (i === index ? value : name)),
    }))
  }

  const addMemberField = () => {
    setDraft((current) => ({
      ...current,
      memberNames: [...current.memberNames, ''],
    }))
  }

  const removeMemberField = (index: number) => {
    setDraft((current) => ({
      ...current,
      memberNames: current.memberNames.filter((_, i) => i !== index),
      payerIndex:
        Number(current.payerIndex) >= current.memberNames.filter((_, i) => i !== index).length
          ? '0'
          : current.payerIndex,
    }))
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    const groupName = draft.groupName.trim()
    if (!groupName) return

    setIsSubmitting(true)
    try {
      const group = await addGroup(groupName)
      setDraft((current) => ({ ...current, groupId: group.id, step: 2 }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateMembers = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.groupId) return

    const cleanNames = draft.memberNames.map((name) => name.trim()).filter(Boolean)
    if (cleanNames.length < 2) return

    setIsSubmitting(true)
    try {
      const existingNames = new Set(
        (groups.find((group) => group.id === draft.groupId)?.members ?? [])
          .filter((member) => !member.deleted)
          .map((member) => member.name.trim().toLowerCase()),
      )

      for (const name of cleanNames) {
        if (!existingNames.has(name.toLowerCase())) {
          await addMember(draft.groupId, name)
        }
      }

      await loadGroups()
      setDraft((current) => ({
        ...current,
        memberNames: cleanNames,
        payerIndex: String(Math.min(Number(current.payerIndex), cleanNames.length - 1)),
        step: 3,
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateFirstExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.groupId || members.length < 2) return

    const amount = parseLocaleNumber(draft.expenseAmount)
    const payer = members[Number(draft.payerIndex)]
    if (!draft.expenseDescription.trim() || !payer || Number.isNaN(amount) || amount <= 0) return

    setIsSubmitting(true)
    try {
      await addExpense({
        groupId: draft.groupId,
        description: draft.expenseDescription.trim(),
        amount,
        payerId: payer.id,
        splitAmong: members.map((member) => member.id),
        splitType: 'equal',
        date: new Date().toISOString().split('T')[0],
      })
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
      navigate(`/group/${draft.groupId}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const cleanMemberNames = draft.memberNames.map((name) => name.trim()).filter(Boolean)
  const canContinueMembers = cleanMemberNames.length >= 2
  const canContinueExpense = !!draft.expenseDescription.trim() && parseLocaleNumber(draft.expenseAmount) > 0 && members.length >= 2

  if (!isReady) {
    return <div className="max-w-2xl mx-auto p-4">Carregant…</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-muted/60 px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Tornar
          </Button>
          <div className="text-sm text-muted-foreground">Pas {draft.step} de 3</div>
        </div>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Comença ràpid i veu el primer balanç en menys d’un minut</h1>
                <p className="max-w-xl text-sm text-indigo-100 sm:text-base">
                  Crea un grup, afegeix la gent i apunta la primera despesa. La idea és que vegis valor de seguida, sense configuracions ni comptes.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/90 backdrop-blur">
                <Shield className="h-4 w-4" />
                Sense comptes. Les dades queden sota el teu control des del primer moment.
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium sm:w-72">
              {[
                { step: 1, label: 'Grup' },
                { step: 2, label: 'Membres' },
                { step: 3, label: 'Despesa' },
              ].map((item) => {
                const isActive = draft.step === item.step
                const isDone = draft.step > item.step
                return (
                  <div
                    key={item.step}
                    className={`rounded-2xl border px-3 py-3 ${isActive ? 'border-white/50 bg-white text-indigo-700 shadow-sm' : isDone ? 'border-white/20 bg-white/15 text-white' : 'border-white/15 bg-black/10 text-white/70'}`}
                  >
                    <div className="mb-1 text-[11px] uppercase tracking-wide">Pas {item.step}</div>
                    <div>{item.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="space-y-6">

        {draft.step === 1 && (
          <Card className="rounded-3xl p-6 shadow-sm sm:p-8">
            <form onSubmit={handleCreateGroup} className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Pas 1</p>
                <h2 className="text-2xl font-semibold tracking-tight">Com es diu el grup?</h2>
                <p className="text-sm text-muted-foreground">Posa-li un nom clar i tira. La resta la podràs ajustar després, des del mateix grup.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-name">Nom del grup</Label>
                <Input
                  id="group-name"
                  value={draft.groupName}
                  onChange={(e) => setDraft((current) => ({ ...current, groupName: e.target.value }))}
                  placeholder="Pis de Gràcia, Viatge a Mallorca, Sopars..."
                  className="h-12 text-base"
                  autoFocus
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={!draft.groupName.trim() || isSubmitting}>
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          </Card>
        )}

        {draft.step === 2 && (
          <Card className="rounded-3xl p-6 shadow-sm sm:p-8">
            <form onSubmit={handleCreateMembers} className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Users className="h-4 w-4" />
                  <p className="text-sm font-medium">Pas 2</p>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Qui forma part del grup?</h2>
                <p className="text-sm text-muted-foreground">Afegeix qui participa al grup perquè el repartiment tingui sentit des del primer moment.</p>
              </div>
              <div className="space-y-3">
                {draft.memberNames.map((memberName, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-2xl border bg-background p-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {index + 1}
                    </div>
                    <Input
                      value={memberName}
                      onChange={(e) => updateMemberName(index, e.target.value)}
                      placeholder={index === 0 ? 'Tu' : `Membre ${index + 1}`}
                      className="border-0 shadow-none focus-visible:ring-0"
                    />
                    {draft.memberNames.length > 2 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeMemberField(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={addMemberField}>
                  <Plus className="h-4 w-4 mr-1" />
                  Afegir membre
                </Button>
                <div className="rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {cleanMemberNames.length} membres preparats
                </div>
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  Enrere
                </Button>
                <Button type="submit" size="lg" disabled={!canContinueMembers || isSubmitting}>
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          </Card>
        )}

        {draft.step === 3 && (
          <Card className="rounded-3xl p-6 shadow-sm sm:p-8">
            <form onSubmit={handleCreateFirstExpense} className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Pas 3</p>
                <h2 className="text-2xl font-semibold tracking-tight">Registra la primera despesa</h2>
                <p className="text-sm text-muted-foreground">Amb això ja veuràs qui ha pagat, com queda repartit i si algú ha d’abonar diners.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-description">Quina ha estat la primera despesa?</Label>
                <Input
                  id="expense-description"
                  value={draft.expenseDescription}
                  onChange={(e) => setDraft((current) => ({ ...current, expenseDescription: e.target.value }))}
                  placeholder="Sopar, compra, taxi..."
                  className="h-12"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-amount">Import</Label>
                  <Input
                    id="expense-amount"
                    type="text"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={draft.expenseAmount}
                    onChange={(e) => setDraft((current) => ({ ...current, expenseAmount: e.target.value }))}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qui ha pagat?</Label>
                  <Select value={draft.payerIndex} onValueChange={(value) => setDraft((current) => ({ ...current, payerIndex: value }))}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member, index) => (
                        <SelectItem key={member.id} value={String(index)}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Quan acabis:</p>
                <p>• tindràs el grup creat</p>
                <p>• la despesa quedarà repartida entre tots</p>
                <p>• entraràs directament a la vista de balanç</p>
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                  Enrere
                </Button>
                <Button type="submit" size="lg" disabled={!canContinueExpense || isSubmitting}>
                  <Check className="h-4 w-4 mr-1" />
                  Veure balanç
                </Button>
              </div>
            </form>
          </Card>
        )}
          </div>

          <Card className="rounded-3xl p-5 shadow-sm lg:sticky lg:top-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resum ràpid</p>
                <h3 className="mt-1 font-semibold">El que ja tens preparat</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-2xl bg-muted/40 p-3">
                  <div className="text-muted-foreground">Grup</div>
                  <div className="font-medium">{draft.groupName.trim() || 'Encara sense nom'}</div>
                </div>
                <div className="rounded-2xl bg-muted/40 p-3">
                  <div className="text-muted-foreground">Membres</div>
                  <div className="font-medium">{cleanMemberNames.length > 0 ? cleanMemberNames.join(', ') : 'Encara no n’has afegit'}</div>
                </div>
                <div className="rounded-2xl bg-muted/40 p-3">
                  <div className="text-muted-foreground">Primera despesa</div>
                  <div className="font-medium">{draft.expenseDescription.trim() || 'Sense definir'}{draft.expenseAmount && !Number.isNaN(parseLocaleNumber(draft.expenseAmount)) ? ` · ${formatMoney(parseLocaleNumber(draft.expenseAmount))}` : ''}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100">
                Aquest flux està pensat perquè comencis ràpid. Ja tindràs temps després per compartir, sincronitzar o guardar còpies del grup.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
