import { useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSync } from '@/hooks/useSync'
import { useStore } from '@/store'
import { decodeBase64Url } from '@/lib/base64url'
import { saveStoredSyncPassphrase } from '@/lib/sync-passphrase'
import type { SyncReport } from '@/domain/services/sync'

/** Sync states where the session is still loading/in-progress */
const LOADING_STATES = new Set(['idle', 'initializing', 'connecting', 'syncing', 'waiting-for-peer'])

function SyncReportSummary({ report }: { report: SyncReport }) {
  const totalCreated =
    report.created.groups +
    report.created.expenses +
    report.created.payments +
    report.created.members
  const totalUpdated =
    report.updated.groups +
    report.updated.expenses +
    report.updated.payments +
    report.updated.members

  const parts: string[] = []
  if (report.created.groups > 0) parts.push('Grup creat')
  if (totalCreated > 0)
    parts.push(`${totalCreated} element${totalCreated !== 1 ? 's nous' : ' nou'}`)
  if (totalUpdated > 0)
    parts.push(`${totalUpdated} actualitzat${totalUpdated !== 1 ? 's' : ''}`)
  if (parts.length === 0) parts.push('Cap canvi — les dades ja estaven al dia')

  return <p className="text-sm text-muted-foreground mt-1">{parts.join(' · ')}</p>
}

export function SyncFromUrl() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loadGroups, loadGroupData } = useStore()

  const groupId = searchParams.get('g') ?? ''
  const encodedPassphrase = searchParams.get('k') ?? ''

  // Decode passphrase synchronously from URL params
  type UrlParamResult = { passphrase: string; error?: never } | { error: string; passphrase?: never }
  const decoded: UrlParamResult = (() => {
    if (!groupId || !encodedPassphrase) {
      return { error: 'Enllaç de sincronització invàlid. Falten paràmetres.' }
    }
    try {
      const passphrase = decodeBase64Url(encodedPassphrase)
      if (passphrase.length < 4) {
        return { error: 'La contrasenya de l\'enllaç és massa curta.' }
      }
      return { passphrase }
    } catch {
      return { error: 'No s\'ha pogut descodificar l\'enllaç.' }
    }
  })()

  const passphrase = decoded.passphrase ?? ''
  const decodeError = decoded.error ?? null
  const autoStarted = useRef(false)

  const sync = useSync({
    groupId,
    passphrase,
  })

  useEffect(() => {
    if (passphrase) {
      saveStoredSyncPassphrase(groupId, passphrase)
    }
  }, [groupId, passphrase])

  // Extract stable references to avoid re-triggering the effect on every render
  const syncState = sync.state
  const syncJoinSession = sync.joinSession

  // Auto-start join when passphrase is decoded and no error
  useEffect(() => {
    if (passphrase && !decodeError && !autoStarted.current && syncState === 'idle') {
      autoStarted.current = true
      syncJoinSession().catch(() => {
        // Error handled by the sync hook
      })
    }
  }, [passphrase, decodeError, syncState, syncJoinSession])

  const handleDone = async () => {
    saveStoredSyncPassphrase(groupId, passphrase)
    sync.reset()
    await loadGroups()
    await loadGroupData(groupId)
    navigate(`/group/${groupId}`)
  }

  const handleRetry = () => {
    saveStoredSyncPassphrase(groupId, passphrase)
    autoStarted.current = false
    sync.reset()
  }

  // Error decoding URL
  if (decodeError) {
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
              <h1 className="text-2xl font-bold">Sincronització P2P</h1>
              <p className="text-indigo-200 text-sm">Via enllaç directe</p>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 -mt-6 pb-12">
          <Card className="shadow-md border-destructive/30">
            <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Enllaç invàlid</p>
                <p className="text-sm text-muted-foreground mt-1">{decodeError}</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/')}>
                Tornar a l&apos;inici
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
            <h1 className="text-2xl font-bold">Continuar grup en aquest dispositiu</h1>
            <p className="text-indigo-200 text-sm">Via enllaç o QR</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 pb-12">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Connectant aquest dispositiu al grup
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Si tot va bé, en pocs segons veuràs el grup aquí mateix.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status display */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {LOADING_STATES.has(sync.state) && sync.state !== 'waiting-for-peer' && (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                {sync.state === 'completed' && (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                )}
                {sync.state === 'error' && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                {sync.state === 'waiting-for-peer' && (
                  <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                )}

                <Badge
                  variant={
                    sync.state === 'error'
                      ? 'destructive'
                      : sync.state === 'completed'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {sync.state === 'idle' && 'Preparant…'}
                  {sync.state === 'initializing' && 'Inicialitzant…'}
                  {sync.state === 'connecting' && 'Connectant…'}
                  {sync.state === 'waiting-for-peer' && 'Esperant host…'}
                  {sync.state === 'syncing' && 'Sincronitzant…'}
                  {sync.state === 'completed' && 'Completat'}
                  {sync.state === 'error' && 'Error'}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Què està passant?</p>
              <p className="mt-1">Aquest flux serveix per continuar un grup existent en aquest dispositiu. No estàs entrant a un sistema d’usuaris ni acceptant una invitació personal.</p>
            </div>

            {LOADING_STATES.has(sync.state) && (
              <div className="rounded-xl border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
                Mantén oberta aquesta pantalla mentre l’altre dispositiu completa la connexió.
              </div>
            )}

            {/* Message */}
            <p className="text-sm font-medium leading-snug">
              {sync.message || 'Connectant amb l\'altre dispositiu…'}
            </p>

            {/* Error details */}
            {sync.state === 'error' && sync.error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {sync.error}
              </div>
            )}

            {/* Sync report on success */}
            {sync.state === 'completed' && sync.report && (
              <div className="rounded-md bg-muted p-3">
                <SyncReportSummary report={sync.report} />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {sync.state === 'completed' && (
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white"
                  onClick={handleDone}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Veure el grup
                </Button>
              )}
              {sync.state === 'error' && (
                <>
                  <Button variant="outline" className="w-full" onClick={handleRetry}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tornar a intentar
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => navigate('/')}
                  >
                    Tornar a l&apos;inici
                  </Button>
                </>
              )}
            </div>

            {/* Waiting info */}
            {LOADING_STATES.has(sync.state) && (
              <p className="text-xs text-muted-foreground">
                La connexió és directa entre dispositius. El link o QR només obre aquest flux; les dades del grup viatgen protegides.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
