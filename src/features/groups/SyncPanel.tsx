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
import type { SyncReport } from '@/domain/services/sync'

interface SyncPanelProps {
  groupId: string
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
    'waiting-for-peer': 'outline',
    'connecting': 'outline',
    'syncing': 'default',
    'completed': 'secondary',
    'error': 'destructive',
  }

  return <Badge variant={variants[state] ?? 'secondary'}>{labels[state] ?? state}</Badge>
}

export function SyncPanel({ groupId }: SyncPanelProps) {
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
  const [copiedLink, setCopiedLink] = useState(false)
  const { loadGroups, loadGroupData } = useStore()

  const sync = useSync({
    groupId,
    passphrase,
    autoRetryEnabled: mode !== 'idle',
  })

  const isActive = sync.state !== 'idle' && sync.state !== 'error' && sync.state !== 'completed'
  const canStart = passphrase.length >= 4

  useEffect(() => {
    setPassphrase(rememberedPassphrase)
  }, [rememberedPassphrase])

  useEffect(() => {
    saveStoredSyncPassphrase(groupId, passphrase)
  }, [groupId, passphrase])

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
    await navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 3000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Sincronitzar grup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Posa aquest grup al dia entre dispositius amb una sola acció.
          Si l'altre dispositiu és a punt, la sincronització començarà automàticament.
        </p>

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
                  className="h-7 text-xs"
                >
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? 'Copiat' : 'ID'}
                </Button>
              )}
            </div>

            {/* Status message */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{sync.message}</p>
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
              {(sync.remotePeerIds.length > 0 || sync.lastAttemptAt || sync.lastSuccessAt) && (
                <details className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium text-foreground/80">
                    Detalls de sincronització
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
                    {sync.autoRetryEnabled && (
                      <p>Reintent automàtic actiu mentre aquest panell estigui obert</p>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Instructions for host + share link */}
            {mode === 'host' && sync.state === 'waiting-for-peer' && (
              <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-3">
                <div className="space-y-1">
                  <p className="font-medium">Falta l'altre dispositiu</p>
                  <p className="text-muted-foreground">
                    Comparteix aquest enllaç i la sincronització començarà quan l'obrin.
                  </p>
                </div>
                <ol className="space-y-1 text-muted-foreground">
                  <li>1. Copia l'enllaç</li>
                  <li>2. Obre'l a l'altre dispositiu</li>
                  <li>3. Reparteix es connectarà i posarà el grup al dia</li>
                </ol>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySyncLink}
                  className="w-full"
                >
                  {copiedLink ? <Check className="h-4 w-4 mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                  {copiedLink ? 'Enllaç copiat!' : 'Copiar enllaç'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Si prefereixes, també pots obrir Reparteix a l'altre dispositiu, entrar al mateix grup i prémer «Sincronitzar» amb la mateixa contrasenya.
                </p>
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
                      Fet
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
      </CardContent>
    </Card>
  )
}
