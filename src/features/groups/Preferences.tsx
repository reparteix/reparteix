import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Monitor, Moon, Settings2, Smartphone, Sun, Wifi } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useTheme } from '@/hooks/useTheme'
import {
  clearSyncPreferencesDraft,
  draftToSyncConfigOverrides,
  getDefaultSyncPreferencesDraft,
  loadSyncPreferencesDraft,
  saveSyncPreferencesDraft,
  type SyncPreferencesDraft,
} from '@/lib/sync-preferences'
import {
  getDefaultDeviceLabel,
  getLocalDeviceIdentity,
  resetLocalDeviceLabel,
  updateLocalDeviceLabel,
} from '@/lib/device-identity'

const themeOptions = [
  { value: 'light' as const, label: 'Clar', icon: Sun },
  { value: 'dark' as const, label: 'Fosc', icon: Moon },
  { value: 'system' as const, label: 'Sistema', icon: Monitor },
]

function ThemePreferenceCard() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aparença</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const Icon = option.icon
            const active = theme === option.value

            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? 'default' : 'outline'}
                className="justify-start gap-2"
                onClick={() => setTheme(option.value)}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </Button>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Tema actiu: <strong>{themeOptions.find((option) => option.value === theme)?.label}</strong>
          {theme === 'system' ? `, resolt ara com a ${resolvedTheme === 'dark' ? 'fosc' : 'clar'}` : ''}.
        </p>
      </CardContent>
    </Card>
  )
}

function DeviceIdentityCard() {
  const [identity, setIdentity] = useState(() => getLocalDeviceIdentity())
  const [deviceLabel, setDeviceLabel] = useState(identity.deviceLabel)
  const [status, setStatus] = useState<'idle' | 'saved' | 'reset'>('idle')
  const statusTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current)
      }
    }
  }, [])

  const scheduleStatusReset = () => {
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current)
    }

    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus('idle')
      statusTimeoutRef.current = null
    }, 2000)
  }

  const handleSave = () => {
    const next = updateLocalDeviceLabel(deviceLabel)
    setIdentity(next)
    setDeviceLabel(next.deviceLabel)
    setStatus('saved')
    scheduleStatusReset()
  }

  const handleReset = () => {
    const next = resetLocalDeviceLabel()
    setIdentity(next)
    setDeviceLabel(next.deviceLabel)
    setStatus('reset')
    scheduleStatusReset()
  }

  const defaultLabel = getDefaultDeviceLabel(identity.deviceId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Aquest dispositiu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Aquesta identitat és local al dispositiu actual. L’id és estable i el nom es pot editar per fer-lo més reconeixible quan arribi a activitat o sync.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="device-id">Id del dispositiu</Label>
          <Input id="device-id" value={identity.deviceId} readOnly className="font-mono text-xs" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="device-label">Nom del dispositiu</Label>
          <Input
            id="device-label"
            value={deviceLabel}
            onChange={(e) => setDeviceLabel(e.target.value)}
            placeholder={defaultLabel}
          />
          <p className="text-xs text-muted-foreground">
            Si el deixes buit, es farà servir un fallback distingible com <strong>{defaultLabel}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave}>Desar nom</Button>
          <Button type="button" variant="outline" onClick={handleReset}>Restaurar fallback</Button>
          {status === 'saved' && <p className="text-sm text-success self-center">Nom del dispositiu desat.</p>}
          {status === 'reset' && <p className="text-sm text-success self-center">Fallback restaurat.</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function SyncPreferencesCard() {
  const [draft, setDraft] = useState<SyncPreferencesDraft>(() => loadSyncPreferencesDraft())
  const [status, setStatus] = useState<'idle' | 'saved' | 'reset'>('idle')
  const statusTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    saveSyncPreferencesDraft(draft)
  }, [draft])

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current)
      }
    }
  }, [])

  const preview = useMemo(() => draftToSyncConfigOverrides(draft), [draft])

  const scheduleStatusReset = () => {
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current)
    }

    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus('idle')
      statusTimeoutRef.current = null
    }, 2000)
  }

  const setField = <K extends keyof SyncPreferencesDraft>(key: K, value: SyncPreferencesDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setStatus('saved')
    scheduleStatusReset()
  }

  const handleReset = () => {
    const next = getDefaultSyncPreferencesDraft()
    setDraft(next)
    clearSyncPreferencesDraft()
    saveSyncPreferencesDraft(next)
    setStatus('reset')
    scheduleStatusReset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sincronització avançada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Configura el servidor de signaling i els servidors STUN si vols fer servir infraestructura pròpia o provar un entorn diferent.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="peer-host">PeerJS host</Label>
          <Input
            id="peer-host"
            value={draft.peerJsHost}
            onChange={(e) => setField('peerJsHost', e.target.value)}
            placeholder="0.peerjs.com"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="peer-port">PeerJS port</Label>
            <Input
              id="peer-port"
              inputMode="numeric"
              value={draft.peerJsPort}
              onChange={(e) => setField('peerJsPort', e.target.value)}
              placeholder="443"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="peer-path">PeerJS path</Label>
            <Input
              id="peer-path"
              value={draft.peerJsPath}
              onChange={(e) => setField('peerJsPath', e.target.value)}
              placeholder="/"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Connexió segura</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={draft.peerJsSecure ? 'default' : 'outline'}
              onClick={() => setField('peerJsSecure', true)}
            >
              HTTPS
            </Button>
            <Button
              type="button"
              variant={!draft.peerJsSecure ? 'default' : 'outline'}
              onClick={() => setField('peerJsSecure', false)}
            >
              HTTP
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stun-urls">Servidors STUN</Label>
          <Textarea
            id="stun-urls"
            value={draft.stunUrls}
            onChange={(e) => setField('stunUrls', e.target.value)}
            rows={5}
            placeholder="stun:stun.l.google.com:19302&#10;stun:stun1.l.google.com:19302"
          />
          <p className="text-xs text-muted-foreground">Un URL per línia. El suport TURN queda pendent per una iteració posterior.</p>
        </div>

        <Separator />

        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <p className="font-medium">Preview efectiva</p>
          <p className="text-muted-foreground">
            {preview.peerJs?.secure ? 'https' : 'http'}://{preview.peerJs?.host}:{preview.peerJs?.port}{preview.peerJs?.path}
          </p>
          <p className="text-muted-foreground">
            {preview.iceServers?.length ?? 0} servidor{(preview.iceServers?.length ?? 0) === 1 ? '' : 's'} ICE configurat{(preview.iceServers?.length ?? 0) === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            Restaurar valors per defecte
          </Button>
          {status === 'saved' && <p className="text-sm text-success self-center">Preferències desades.</p>}
          {status === 'reset' && <p className="text-sm text-success self-center">Valors per defecte restaurats.</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function Preferences() {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          aria-label="Tornar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Preferències</h1>
          <p className="text-sm text-muted-foreground">Aparença i configuració avançada del dispositiu.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <Settings2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Preferències globals</p>
              <p className="text-sm text-muted-foreground">
                Aquestes opcions s'apliquen al dispositiu actual. No canvien les dades dels grups ni es comparteixen amb altres persones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ThemePreferenceCard />

      <DeviceIdentityCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            P2P i connectivitat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Si no toques res, Reparteix continua amb la configuració pública per defecte. Aquesta secció és per desplegaments propis, proves o entorns més avançats.
          </p>
        </CardContent>
      </Card>

      <SyncPreferencesCard />
    </div>
  )
}
