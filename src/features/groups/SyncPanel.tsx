import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Link2,
  ShieldCheck,
  Smartphone,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSync } from '@/hooks/useSync'
import { useStore } from '@/store'
import { encodeBase64Url } from '@/lib/base64url'
import { loadStoredSyncPassphrase, saveStoredSyncPassphrase } from '@/lib/sync-passphrase'
import { shareUrl } from '@/lib/web-share'
import type { SyncReport } from '@/domain/services/sync'

interface SyncPanelProps {
  groupId: string
  embedded?: boolean
  onActiveStateChange?: (active: boolean) => void
}

/**
 * Build a shareable sync URL that the receiver can open to auto-join the P2P session.
 */
function buildSyncUrl(groupId: string, passphrase: string): string {
  const k = encodeBase64Url(passphrase)
  return `${window.location.origin}${window.location.pathname}#/sync?g=${encodeURIComponent(groupId)}&k=${k}`
}

function SyncReportDetails({ report }: { report: SyncReport }) {
  const totalCreated = report.created.groups + report.created.expenses + report.created.payments + report.created.members
  const totalUpdated = report.updated.groups + report.updated.expenses + report.updated.payments + report.updated.members
  const totalSkipped = report.skipped.expenses + report.skipped.payments + report.skipped.members
  const totalRejected = report.rejected.length
  const totalConflicts = report.conflicts.length

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {totalCreated > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span>{totalCreated} creat{totalCreated > 1 ? 's' : ''}</span>
          </div>
        )}
        {totalUpdated > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>{totalUpdated} actualitzat{totalUpdated > 1 ? 's' : ''}</span>
          </div>
        )}
        {totalSkipped > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span>{totalSkipped} sense canvis</span>
          </div>
        )}
        {totalRejected > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <span>{totalRejected} rebutjat{totalRejected > 1 ? 's' : ''}</span>
          </div>
        )}
        {totalConflicts > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{totalConflicts} conflicte{totalConflicts > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {totalCreated === 0 && totalUpdated === 0 && totalConflicts === 0 && totalRejected === 0 && (
        <p className="text-muted-foreground">Les dades ja estaven al dia.</p>
      )}

      {report.created.members > 0 && (
        <p className="text-muted-foreground">
          {report.created.members} membre{report.created.members > 1 ? 's' : ''} nou{report.created.members > 1 ? 's' : ''}
        </p>
      )}
      {report.created.expenses > 0 && (
        <p className="text-muted-foreground">
          {report.created.expenses} despesa{report.created.expenses > 1 ? 'es' : ''} nova{report.created.expenses > 1 ? 'es' : ''}
        </p>
      )}
      {report.created.payments > 0 && (
        <p className="text-muted-foreground">
          {report.created.payments} pagament{report.created.payments > 1 ? 's' : ''} nou{report.created.payments > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

function StateIcon({ state }: { state: string }) {
  switch (state) {
    case 'idle':
      return <Wifi className="h-5 w-5 text-muted-foreground" />
    case 'initializing':
    case 'connecting':
    case 'syncing':
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />
    case 'waiting-for-peer':
      return <RefreshCw className="h-5 w-5 text-primary animate-spin" />
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-success" />
    case 'error':
      return <AlertCircle className="h-5 w-5 text-destructive" />
    default:
      return <WifiOff className="h-5 w-5 text-muted-foreground" />
  }
}

function formatSyncTimestamp(value: string | null): string | null {
  if (!value) return null

  try {
    return new Date(value).toLocaleString('ca-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

function StateBadge({ state }: { state: string }) {
  const labels: Record<string, string> = {
    'idle': 'Preparat',
    'initializing': 'Inicialitzant…',
    'waiting-for-peer': 'Esperant peer…',
    'connecting': 'Connectant…',
    'syncing': 'Sincronitzant…',
    'completed': 'Completat',
    'error': 'Error',
  }

  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'idle': 'secondary',
    'initializing': 'outline',
    'waiting-for-peer': 'secondary',
    'connecting': 'outline',
    'syncing': 'default',
    'completed': 'secondary',
    'error': 'destructive',
  }

  return (
    <Badge
      variant={variants[state] ?? 'secondary'}
      className={state === 'waiting-for-peer' ? 'bg-success/10 text-success border-success/20 hover:bg-success/10' : undefined}
    >
      {labels[state] ?? state}
    </Badge>
  )
}

function SyncStepList({ state }: { state: string }) {
  const steps = [
    {
      key: 'prepare',
      title: 'Prepara l\'altre dispositiu',
      description: 'Obrirà un enllaç i entrarà directament al flux de sync d\'aquest grup.',
      active: state === 'idle' || state === 'initializing' || state === 'waiting-for-peer',
      done: state === 'connecting' || state === 'syncing' || state === 'completed',
    },
    {
      key: 'connect',
      title: 'Connexió privada entre dispositius',
      description: 'Els dos dispositius es troben i estableixen la connexió de sync.',
      active: state === 'connecting',
      done: state === 'syncing' || state === 'completed',
    },
    {
      key: 'finish',
      title: 'Intercanvi i actualització de dades',
      description: 'Reparteix envia només les dades del grup i després et mostra el resultat.',
      active: state === 'syncing',
      done: state === 'completed',
    },
  ]

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-start gap-3 rounded-xl bg-muted/40 px-3 py-3">
          <div className="mt-0.5 flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step.done ? 'bg-success/15 text-success' : step.active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{step.title}</p>
            <p className="text-xs leading-5 text-muted-foreground">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SyncPanel({ groupId, embedded = false, onActiveStateChange }: SyncPanelProps) {
  const group = useStore((state) => state.groups.find((item) => item.id === groupId))
  const updateGroup = useStore((state) => state.updateGroup)
  const rememberedPassphrase = useMemo(
    () => group?.syncPassphrase || loadStoredSyncPassphrase(groupId),
    [group?.syncPassphrase, groupId],
  )

  const [passphrase, setPassphrase] = useState(rememberedPassphrase)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle')
  const [copied, setCopied] = useState(false)
  const [sharedLinkStatus, setSharedLinkStatus] = useState<'idle' | 'shared' | 'copied'>('idle')
  const { loadGroups, loadGroupData } = useStore()

  const sync = useSync({
    groupId,
    passphrase,
    autoRetryEnabled: mode !== 'idle',
  })

  const isActive = sync.state !== 'idle' && sync.state !== 'error' && sync.state !== 'completed'
  const canStart = passphrase.length >= 4
  const showSetupCopy = sync.state === 'idle'
  const showCompactStatusDetails = sync.state !== 'idle' && !sync.error
  const isWaitingForPeer = mode === 'host' && sync.state === 'waiting-for-peer'

  useEffect(() => {
    setPassphrase(rememberedPassphrase)
  }, [rememberedPassphrase])

  useEffect(() => {
    saveStoredSyncPassphrase(groupId, passphrase)
  }, [groupId, passphrase])

  useEffect(() => {
    onActiveStateChange?.(isActive)
    return () => {
      onActiveStateChange?.(false)
    }
  }, [isActive, onActiveStateChange])

  const persistPassphrase = async (value: string) => {
    const nextValue = value.trim()
    saveStoredSyncPassphrase(groupId, nextValue)

    if (group && group.syncPassphrase !== nextValue) {
      await updateGroup(groupId, { syncPassphrase: nextValue })
    }
  }

  const handleReset = () => {
    sync.reset()
    setMode('idle')
  }

  const handleDone = async () => {
    sync.reset()
    setMode('idle')
    setPassphrase('')
    // Reload data to reflect sync changes
    await loadGroups()
    await loadGroupData(groupId)
  }

  const handleCopyPeerId = async () => {
    if (sync.peerId) {
      await navigator.clipboard.writeText(sync.peerId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopySyncLink = async () => {
    const url = buildSyncUrl(groupId, passphrase)
    const result = await shareUrl({
      title: `Sync de grup · Reparteix`,
      text: 'Obre aquest enllaç a l\'altre dispositiu per sincronitzar el grup a Reparteix',
      url,
    })
    if (result.method === 'cancelled') return
    setSharedLinkStatus(result.method === 'clipboard' ? 'copied' : 'shared')
    setTimeout(() => setSharedLinkStatus('idle'), 3000)
  }

  const content = (
    <div className="space-y-4">
      {showSetupCopy && (
        <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Sincronitza aquest grup amb un altre dispositiu</p>
              <p className="text-sm text-muted-foreground">
                Ideal si vols continuar el mateix grup al mòbil, tauleta o un altre navegador sense exportar ni importar fitxers manualment.
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span className="font-medium">Privat per disseny</span>
            </div>
            <p>
              L'enllaç només serveix per connectar els dos dispositius. Les dades del grup viatgen protegides amb la contrasenya del grup.
            </p>
          </div>
        </div>
      )}

        {/* Passphrase input */}
        <div className="space-y-1.5">
          <Label htmlFor="sync-passphrase">Contrasenya del grup</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="sync-passphrase"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onBlur={() => {
                  void persistPassphrase(passphrase)
                }}
                placeholder="Mínim 4 caràcters"
                disabled={isActive}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassphrase ? 'Amagar contrasenya' : 'Mostrar contrasenya'}
              >
                {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Aquesta contrasenya es guarda al grup i en aquest dispositiu perquè no l'hagis d'escriure cada vegada.
          </p>
        </div>

        {sync.state === 'idle' && (
          <Button
            onClick={async () => {
              setMode('host')
              try {
                await persistPassphrase(passphrase)
                await sync.startSync()
              } catch {
                // Error is handled by the sync hook
              }
            }}
            disabled={!canStart}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronitzar
          </Button>
        )}

        {showSetupCopy && <SyncStepList state={sync.state} />}

        {/* Active sync status */}
        {sync.state !== 'idle' && (
          <div className="space-y-3">
            {/* Status header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StateIcon state={sync.state} />
                <StateBadge state={sync.state} />
              </div>
              {mode === 'host' && sync.peerId && sync.state === 'waiting-for-peer' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPeerId}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? 'Copiat' : 'ID'}
                </Button>
              )}
            </div>

            {/* Status message */}
            <div className="space-y-3">
              <p className="text-sm font-medium leading-snug">{sync.message}</p>
              <SyncStepList state={sync.state} />
              {sync.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Error de sincronització</p>
                      <p>{sync.error}</p>
                    </div>
                  </div>
                </div>
              )}
              {isWaitingForPeer && (
                <div className="rounded-xl border bg-primary/5 p-3 text-sm text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Què ha de fer l'altre dispositiu ara?
                  </div>
                  <p>Obrir l'enllaç compartit, comprovar la mateixa contrasenya del grup i esperar que la connexió es completi.</p>
                </div>
              )}
              {showCompactStatusDetails && (sync.remotePeerIds.length > 0 || sync.lastAttemptAt || sync.lastSuccessAt) && (
                <details className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium text-foreground/80">
                    Detalls
                  </summary>
                  <div className="mt-2 space-y-1">
                    {sync.remotePeerIds.length > 0 && (
                      <p>Dispositius detectats: {sync.remotePeerIds.join(', ')}</p>
                    )}
                    {sync.lastAttemptAt && (
                      <p>Últim intent: {formatSyncTimestamp(sync.lastAttemptAt)}</p>
                    )}
                    {sync.lastSuccessAt && (
                      <p>Última sincronització correcta: {formatSyncTimestamp(sync.lastSuccessAt)}</p>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Instructions for host + share link */}
            {mode === 'host' && sync.state === 'waiting-for-peer' && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
                <p className="text-muted-foreground">
                  Comparteix l'enllaç amb l'altre dispositiu i la sincronització començarà quan l'obrin.
                </p>
                <Button
                  size="sm"
                  onClick={handleCopySyncLink}
                  className="w-full"
                >
                  {sharedLinkStatus !== 'idle' ? <Check className="h-4 w-4 mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                  {sharedLinkStatus === 'shared' ? 'Enllaç compartit!' : sharedLinkStatus === 'copied' ? 'Enllaç copiat!' : 'Compartir enllaç'}
                </Button>
              </div>
            )}

            {/* Sync report */}
            {sync.report && (
              <div className="rounded-lg border bg-success/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Grup sincronitzat
                </div>
                <SyncReportDetails report={sync.report} />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {(sync.state === 'completed' || sync.state === 'error') && (
                <>
                  {sync.state === 'completed' && (
                    <Button onClick={handleDone} className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Tancar
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleReset} className={sync.state === 'error' ? 'flex-1' : ''}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tornar a intentar
                  </Button>
                </>
              )}
              {isActive && (
                <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                  Cancel·lar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
  )

  if (embedded) {
    return content
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Sincronitzar grup
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
