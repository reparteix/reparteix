import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Link2, Radio, Shield, Wifi } from 'lucide-react'
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

export function SyncPocPanel({ group }: SyncPocPanelProps) {
  const { expenses } = useStore()
  const [peerId, setPeerId] = useState(() => randomId('host'))
  const [remotePeerId, setRemotePeerId] = useState('')
  const [invitePayload, setInvitePayload] = useState('')
  const [joinPayload, setJoinPayload] = useState('')
  const [status, setStatus] = useState<string[]>([])
  const [hostInput, setHostInput] = useState(DEFAULT_CONFIG.host ?? '')
  const [pathInput, setPathInput] = useState(DEFAULT_CONFIG.path ?? '/')
  const [stunInput, setStunInput] = useState('stun:stun.l.google.com:19302')

  const transportRef = useRef<WebRtcSyncTransportPeer | null>(null)
  const sessionRef = useRef<ReturnType<typeof createSyncSession> | null>(null)
  const groupKeyRef = useRef<Uint8Array | null>(null)

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

  const pushStatus = (message: string) => {
    setStatus((current) => [message, ...current].slice(0, 8))
  }

  const rtcConfig = (): SyncRtcConfig => ({
    host: hostInput || undefined,
    port: hostInput ? 443 : undefined,
    path: pathInput || '/',
    secure: true,
    iceServers: stunInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((urls) => ({ urls })),
  })

  const buildDocFromCurrentGroup = () => {
    const doc = createGroupDoc(group.name)
    for (const expense of activeExpenses) {
      doc.getArray<{ id: string; description: string; amount: number }>('expenses').push([
        { id: expense.id, description: expense.description, amount: expense.amount },
      ])
    }
    return doc
  }

  const startHosting = async () => {
    sessionRef.current?.stop()
    transportRef.current?.destroy()

    const groupKey = await generateGroupKey()
    groupKeyRef.current = groupKey

    const transport = createWebRtcSyncPeer({
      peerId,
      config: rtcConfig(),
      onStatus: pushStatus,
    })
    const doc = buildDocFromCurrentGroup()
    const session = createSyncSession(doc, groupKey, transport)
    session.start()

    transportRef.current = transport
    sessionRef.current = session

    const payload = await createInvitePayload(groupKey, group.id)
    setInvitePayload(JSON.stringify({ payload, peerId }, null, 2))
    pushStatus('Host preparat. Comparteix l’invite amb un altre peer.')
  }

  const joinHost = async () => {
    sessionRef.current?.stop()
    transportRef.current?.destroy()

    const parsed = JSON.parse(joinPayload) as { payload: string; peerId: string }
    const invite = await readInvitePayload(parsed.payload)
    groupKeyRef.current = invite.groupKey
    setRemotePeerId(parsed.peerId)

    const transport = createWebRtcSyncPeer({
      peerId,
      remotePeerId: parsed.peerId,
      config: rtcConfig(),
      onStatus: pushStatus,
    })
    const session = createSyncSession(createGroupDoc(group.name), invite.groupKey, transport)
    session.start()

    transportRef.current = transport
    sessionRef.current = session
    pushStatus(`Join preparat per al grup ${invite.groupId}. Esperant dades...`)
  }

  const syncNow = async () => {
    if (!sessionRef.current) {
      pushStatus('No hi ha sessió activa')
      return
    }
    await sessionRef.current.pushState()
    pushStatus('S’ha enviat un update xifrat al peer connectat')
  }

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value)
    pushStatus('Copiat al porta-retalls')
  }

  return (
    <Card className="border-dashed border-indigo-300 dark:border-indigo-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4" />
          Sync PoC, WebRTC + PeerJS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-2"><Shield className="h-4 w-4" /> Model de seguretat</p>
          <p>- cada grup genera una <strong>group key</strong> simètrica</p>
          <p>- la clau viatja dins l’invite i s’ha de compartir entre membres actius</p>
          <p>- els updates s’envien xifrats sobre WebRTC</p>
          <p>- si no hi ha cap membre actiu connectat, no hi ha sync en viu</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sync-peer-id">Peer ID local</Label>
            <Input id="sync-peer-id" value={peerId} onChange={(e) => setPeerId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sync-remote-id">Peer remot</Label>
            <Input id="sync-remote-id" value={remotePeerId} onChange={(e) => setRemotePeerId(e.target.value)} placeholder="S'omple fent join o manualment" />
          </div>
        </div>

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
          <Label htmlFor="sync-stun">STUN/TURN URLs (coma separada)</Label>
          <Input id="sync-stun" value={stunInput} onChange={(e) => setStunInput(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={startHosting}>Host</Button>
          <Button variant="secondary" onClick={joinHost}>Join</Button>
          <Button variant="outline" onClick={syncNow}>Sincronitzar ara</Button>
        </div>

        <div className="space-y-2">
          <Label>Invite payload</Label>
          <div className="flex gap-2">
            <Input value={invitePayload} readOnly placeholder="Genera un host i comparteix aquest payload" />
            <Button variant="outline" size="icon" onClick={() => copyText(invitePayload)} disabled={!invitePayload}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Join payload</Label>
          <div className="flex gap-2">
            <Input value={joinPayload} onChange={(e) => setJoinPayload(e.target.value)} placeholder='{"payload":"...","peerId":"host-abc"}' />
            <Button variant="outline" size="icon" onClick={() => copyText(joinPayload)} disabled={!joinPayload}>
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <p className="font-medium flex items-center gap-2"><Wifi className="h-4 w-4" /> Estat</p>
          {status.length === 0 ? (
            <p className="text-muted-foreground">Encara no hi ha activitat.</p>
          ) : (
            <ul className="space-y-1 text-muted-foreground">
              {status.map((line, index) => (
                <li key={`${line}-${index}`}>• {line}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
