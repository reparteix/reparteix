import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Copy, Link2, Shield, Smartphone, Wifi, WifiOff } from 'lucide-react'
import { useStore } from '../../store'
import { createGroupDoc, createInvitePayload, generateGroupKey, readInvitePayload } from '../../sync/poc'
import { createSyncSession } from '../../sync/session'
import { createWebRtcSyncPeer, type SyncRtcConfig, type WebRtcSyncTransportPeer } from '../../sync/webrtc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Group } from '../../domain/entities'

interface SyncPocPanelProps {
  group: Group
}

type SyncMode = 'idle' | 'host-ready' | 'joining' | 'connected'

const DEFAULT_CONFIG: SyncRtcConfig = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function detectDeviceName() {
  if (typeof navigator === 'undefined') return 'Aquest dispositiu'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('iphone')) return 'iPhone'
  if (ua.includes('ipad')) return 'iPad'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('mac os')) return 'Mac'
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('linux')) return 'Linux'
  return 'Aquest dispositiu'
}

function readSyncPayloadFromHash() {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex === -1) return ''
  const search = new URLSearchParams(hash.slice(queryIndex + 1))
  return search.get('sync') ?? ''
}

export function SyncPocPanel({ group }: SyncPocPanelProps) {
  const { expenses } = useStore()
  const [deviceName] = useState(detectDeviceName)
  const [peerId] = useState(() => randomId('device'))
  const [invitePayload, setInvitePayload] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [joinPayload, setJoinPayload] = useState(readSyncPayloadFromHash)
  const [mode, setMode] = useState<SyncMode>('idle')
  const [status, setStatus] = useState('Encara no hi ha sincronització activa.')
  const [details, setDetails] = useState<string[]>([])
  const [hasSession, setHasSession] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [hostInput, setHostInput] = useState(DEFAULT_CONFIG.host ?? '')
  const [pathInput, setPathInput] = useState(DEFAULT_CONFIG.path ?? '/')
  const [stunInput, setStunInput] = useState('stun:stun.l.google.com:19302')

  const transportRef = useRef<WebRtcSyncTransportPeer | null>(null)
  const sessionRef = useRef<ReturnType<typeof createSyncSession> | null>(null)

  const activeExpenses = useMemo(
    () => expenses.filter((expense) => expense.groupId === group.id && !expense.deleted),
    [expenses, group.id],
  )

  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
      transportRef.current?.destroy()
    }
  }, [])

  const pushDetail = (message: string) => {
    setDetails((current) => [message, ...current].slice(0, 6))
  }

  const rtcConfig = useCallback((): SyncRtcConfig => ({
    host: hostInput || undefined,
    port: hostInput ? 443 : undefined,
    path: pathInput || '/',
    secure: true,
    iceServers: stunInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((urls) => ({ urls })),
  }), [hostInput, pathInput, stunInput])

  const buildDocFromCurrentGroup = () => {
    const doc = createGroupDoc(group.name)
    for (const expense of activeExpenses) {
      doc.getArray<{ id: string; description: string; amount: number }>('expenses').push([
        { id: expense.id, description: expense.description, amount: expense.amount },
      ])
    }
    return doc
  }

  const teardown = () => {
    sessionRef.current?.stop()
    transportRef.current?.destroy()
    sessionRef.current = null
    transportRef.current = null
    setHasSession(false)
  }

  const startSync = async () => {
    teardown()
    const groupKey = await generateGroupKey()
    const transport = createWebRtcSyncPeer({
      peerId,
      config: rtcConfig(),
      onStatus: (message) => {
        pushDetail(message)
        if (message.includes('Connexió oberta')) {
          setMode('connected')
          setStatus('Hi ha almenys un altre dispositiu connectat. La sincronització en viu està disponible.')
        }
      },
    })

    const session = createSyncSession(buildDocFromCurrentGroup(), groupKey, transport)
    session.start()

    transportRef.current = transport
    sessionRef.current = session
    setHasSession(true)

    const payload = await createInvitePayload(groupKey, group.id)
    const joinData = JSON.stringify({ payload, peerId, deviceName })
    const url = `${window.location.origin}${window.location.pathname}#/import?sync=${encodeURIComponent(joinData)}`
    setInvitePayload(joinData)
    setInviteUrl(url)
    setMode('host-ready')
    setStatus('Sincronització preparada. Comparteix l’enllaç amb un altre dispositiu.')
    pushDetail('S’ha creat una clau de grup per a aquesta sessió de sync.')
  }

  const joinSync = useCallback(async (rawPayload?: string) => {
    teardown()

    const parsed = JSON.parse(rawPayload ?? joinPayload) as { payload: string; peerId: string; deviceName?: string }
    const invite = await readInvitePayload(parsed.payload)
    const transport = createWebRtcSyncPeer({
      peerId,
      remotePeerId: parsed.peerId,
      config: rtcConfig(),
      onStatus: (message) => {
        pushDetail(message)
        if (message.includes('Connexió oberta')) {
          setMode('connected')
          setStatus(`Connectat amb ${parsed.deviceName ?? 'un altre dispositiu'}. La sync queda viva mentre hi hagi algun peer actiu.`)
        }
      },
    })

    const session = createSyncSession(createGroupDoc(group.name), invite.groupKey, transport)
    session.start()

    transportRef.current = transport
    sessionRef.current = session
    setHasSession(true)
    setMode('joining')
    setStatus('Intentant enllaçar aquest dispositiu amb la sessió existent...')
    pushDetail(`S’està fent join al grup ${invite.groupId}.`)
  }, [group.name, joinPayload, peerId, rtcConfig])

  useEffect(() => {
    if (!joinPayload) return
    const timer = window.setTimeout(() => {
      void joinSync(joinPayload)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [joinPayload, joinSync])

  const syncNow = async () => {
    if (!sessionRef.current) return
    await sessionRef.current.pushState()
    pushDetail('S’ha enviat un update xifrat als peers connectats.')
  }

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value)
    pushDetail('Copiat al porta-retalls.')
  }

  return (
    <Card className="border-indigo-200 dark:border-indigo-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4" />
          Sincronització entre dispositius (PoC)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-muted-foreground">
          <p className="font-medium text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Com funciona
          </p>
          <p>- actives sync en un dispositiu</p>
          <p>- comparteixes un enllaç amb un altre dispositiu o membre actiu</p>
          <p>- l’altre dispositiu pot entrar encara que no tingui el grup carregat abans</p>
          <p>- mentre hi hagi algun peer connectat, els canvis es poden propagar en viu</p>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">Estat</p>
              <p className="text-muted-foreground">{status}</p>
            </div>
            <div className="shrink-0">
              {mode === 'connected' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Connectat
                </span>
              ) : mode === 'idle' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  <WifiOff className="h-4 w-4" />
                  Inactiu
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <Wifi className="h-4 w-4" />
                  Preparat
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={startSync}>Activar sync</Button>
            <Button variant="secondary" onClick={() => joinSync()} disabled={!joinPayload.trim()}>
              Enllaçar dispositiu
            </Button>
            <Button variant="outline" onClick={syncNow} disabled={!hasSession}>
              Forçar sync ara
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Enllaç per a un altre dispositiu</Label>
          <div className="flex gap-2">
            <Input value={inviteUrl} readOnly placeholder="Activa sync per generar un enllaç" />
            <Button variant="outline" size="icon" onClick={() => copyText(inviteUrl)} disabled={!inviteUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            L’enllaç conté la informació d’unió per al primer accés. El receptor pot obrir-lo directament encara que el grup no existeixi localment.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Codi manual d’enllaç</Label>
          <div className="flex gap-2">
            <Input value={invitePayload} readOnly placeholder="Activa sync per generar un codi manual" />
            <Button variant="outline" size="icon" onClick={() => copyText(invitePayload)} disabled={!invitePayload}>
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Enganxar codi si no fas servir enllaç</Label>
          <Input value={joinPayload} onChange={(e) => setJoinPayload(e.target.value)} placeholder='Enganxa aquí el codi generat des d’un altre dispositiu' />
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <button
            type="button"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced ? 'Amagar configuració avançada' : 'Mostrar configuració avançada'}
          </button>
          {showAdvanced && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="sync-host">PeerJS host</Label>
                  <Input id="sync-host" value={hostInput} onChange={(e) => setHostInput(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sync-path">Path</Label>
                  <Input id="sync-path" value={pathInput} onChange={(e) => setPathInput(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sync-stun">STUN/TURN URLs</Label>
                <Input id="sync-stun" value={stunInput} onChange={(e) => setStunInput(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Aquesta part és per canviar a infraestructura pròpia. El flux normal no hauria de requerir tocar-la.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <p className="font-medium text-foreground">Detall tècnic de la sessió</p>
          {details.length === 0 ? (
            <p className="text-muted-foreground">Encara no hi ha esdeveniments.</p>
          ) : (
            <ul className="space-y-1 text-muted-foreground">
              {details.map((line, index) => (
                <li key={`${line}-${index}`}>• {line}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
