import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Receipt, CreditCard, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { reparteix } from '../../sdk'
import type { SyncEnvelopeV1, SyncReport } from '../../sdk'

type ImportState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'preview'
      envelope: SyncEnvelopeV1
      exists: boolean
    }
  | { status: 'importing' }
  | { status: 'done'; groupId: string }

export function ImportFromUrl() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const encoded = searchParams.get('g') ?? ''
  const [state, setState] = useState<ImportState>(() =>
    encoded ? { status: 'loading' } : { status: 'error', message: 'No hi ha cap contingut per importar.' },
  )
  const [report, setReport] = useState<SyncReport | null>(null)

  useEffect(() => {
    if (!encoded) return

    reparteix.share
      .decodeGroup(encoded)
      .then(async (envelope) => {
        const existing = await reparteix.getGroup(envelope.group.id)
        setState({ status: 'preview', envelope, exists: Boolean(existing) })
      })
      .catch((err: unknown) => {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Enllaç invàlid o corrupte.',
        })
      })
  }, [encoded])

  const handleImport = async () => {
    if (state.status !== 'preview') return
    setState({ status: 'importing' })
    try {
      const r = await reparteix.sync.applyGroupJson(state.envelope)
      setReport(r)
      setState({ status: 'done', groupId: state.envelope.group.id })
    } catch (err: unknown) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Error en importar.',
      })
    }
  }

  const handleImportAsCopy = async () => {
    if (state.status !== 'preview') return
    setState({ status: 'importing' })
    try {
      const { group, expenses, payments, exportedAt } = state.envelope
      const newGroupId = crypto.randomUUID()
      const newGroup = await reparteix.importGroup({
        format: 'reparteix-export',
        version: 1,
        exportedAt,
        data: {
          groups: [{ ...group, id: newGroupId }],
          expenses: expenses.map((e) => ({
            ...e,
            id: crypto.randomUUID(),
            groupId: newGroupId,
          })),
          payments: payments.map((p) => ({
            ...p,
            id: crypto.randomUUID(),
            groupId: newGroupId,
          })),
        },
      })
      setState({ status: 'done', groupId: newGroup.id })
    } catch (err: unknown) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Error en importar.',
      })
    }
  }

  return (
    <div className="min-h-screen bg-muted/50">
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-800 dark:to-indigo-950 text-white px-4 pt-10 pb-12">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/10 hover:text-white"
            aria-label="Tornar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Importar grup</h1>
            <p className="text-indigo-200 text-sm">Via enllaç de compartir</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 pb-12">
        {state.status === 'loading' && (
          <Card className="shadow-md">
            <CardContent className="py-12 flex justify-center">
              <p className="text-muted-foreground">Descodificant l'enllaç…</p>
            </CardContent>
          </Card>
        )}

        {state.status === 'error' && (
          <Card className="shadow-md border-destructive/30">
            <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">No s'ha pogut importar</p>
                <p className="text-sm text-muted-foreground mt-1">{state.message}</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/')}>
                Tornar a l'inici
              </Button>
            </CardContent>
          </Card>
        )}

        {state.status === 'preview' && (
          <PreviewCard
            envelope={state.envelope}
            exists={state.exists}
            onImport={handleImport}
            onImportAsCopy={handleImportAsCopy}
            onCancel={() => navigate('/')}
          />
        )}

        {state.status === 'importing' && (
          <Card className="shadow-md">
            <CardContent className="py-12 flex justify-center">
              <p className="text-muted-foreground">Important…</p>
            </CardContent>
          </Card>
        )}

        {state.status === 'done' && (
          <Card className="shadow-md">
            <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="h-10 w-10 text-success" />
              <div>
                <p className="font-semibold text-success">Grup importat correctament</p>
                {report && <SyncReportSummary report={report} />}
              </div>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white"
                onClick={() => navigate(`/group/${state.groupId}`)}
              >
                Veure el grup
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

interface PreviewCardProps {
  envelope: SyncEnvelopeV1
  exists: boolean
  onImport: () => void
  onImportAsCopy: () => void
  onCancel: () => void
}

function PreviewCard({ envelope, exists, onImport, onImportAsCopy, onCancel }: PreviewCardProps) {
  const { group, expenses, payments } = envelope
  const activeMembers = group.members.filter((m) => !m.deleted)
  const activeExpenses = expenses.filter((e) => !e.deleted)
  const activePayments = payments.filter((p) => !p.deleted)

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-base">
          {exists ? 'Actualitzar grup existent' : 'Importar grup nou'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Group summary */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 text-3xl shrink-0">
            {group.icon ?? '👥'}
          </div>
          <div>
            <p className="font-semibold text-lg">{group.name}</p>
            {group.description && (
              <p className="text-sm text-muted-foreground">{group.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{group.currency}</p>
          </div>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-3 gap-3">
          <StatBadge icon={<Users className="h-4 w-4" />} count={activeMembers.length} label="membres" />
          <StatBadge icon={<Receipt className="h-4 w-4" />} count={activeExpenses.length} label="despeses" />
          <StatBadge icon={<CreditCard className="h-4 w-4" />} count={activePayments.length} label="pagaments" />
        </div>

        {/* Context message */}
        {exists ? (
          <p className="text-sm text-muted-foreground">
            Aquest grup ja existeix al teu dispositiu. Pots{' '}
            <strong>actualitzar-lo</strong> (les dades més noves guanyen) o{' '}
            <strong>importar-lo com a còpia nova</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aquest grup no existeix al teu dispositiu. Es crearà nou amb totes les dades de l'enllaç.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white"
            onClick={onImport}
          >
            {exists ? 'Actualitzar / Fusionar' : 'Importar grup'}
          </Button>
          {exists && (
            <Button variant="outline" className="w-full" onClick={onImportAsCopy}>
              Importar com a còpia nova
            </Button>
          )}
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onCancel}>
            Cancel·lar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StatBadge({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted text-center">
      <div className="text-muted-foreground">{icon}</div>
      <p className="font-semibold text-lg leading-none">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function SyncReportSummary({ report }: { report: SyncReport }) {
  const parts: string[] = []
  const { created, updated } = report
  const totalCreated = created.expenses + created.payments + created.members
  const totalUpdated = updated.expenses + updated.payments + updated.members + updated.groups

  if (created.groups > 0) parts.push('Grup creat')
  if (totalCreated > 0) {
    const plural = totalCreated !== 1
    parts.push(`${totalCreated} element${plural ? 's nous' : ' nou'}`)
  }
  if (totalUpdated > 0) parts.push(`${totalUpdated} actualitzat${totalUpdated !== 1 ? 's' : ''}`)

  if (parts.length === 0) parts.push('Cap canvi')

  return (
    <p className="text-sm text-muted-foreground mt-1">{parts.join(' · ')}</p>
  )
}
