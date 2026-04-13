import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Download, Share2, Archive, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useStore } from '../../store'
import { reparteix } from '../../sdk'
import { shareUrl } from '@/lib/web-share'
const SyncPanel = lazy(() => import('./SyncPanel').then((m) => ({ default: m.SyncPanel })))
import type { Group } from '../../domain/entities'

const EMOJI_SHORTCUTS = [
  '🏖️', '🍕', '✈️', '🏠', '🎉', '🏕️', '🍺', '🎵', '⚽', '💼',
  '🎒', '🚗', '🎄', '🌍', '🏋️', '🍣', '🎓', '🛒', '🎸', '🏔️',
]

// Limit to a single emoji (most emojis fit within 4 UTF-16 code units)
const MAX_ICON_LENGTH = 4

interface GroupSettingsFormProps {
  group: Group
  groupId: string
}

function GroupSettingsForm({ group, groupId }: GroupSettingsFormProps) {
  const navigate = useNavigate()
  const { updateGroup, deleteGroup, exportGroup, archiveGroup, unarchiveGroup } = useStore()

  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [icon, setIcon] = useState(group.icon ?? '')
  const [currency, setCurrency] = useState(group.currency)
  const [exportStatus, setExportStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [shareStatus, setShareStatus] = useState<'idle' | 'shared' | 'copied' | 'error'>('idle')

  const isArchived = group.archived

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isArchived) return
    await updateGroup(groupId, {
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      currency,
    })
    navigate(`/group/${groupId}`)
  }

  const handleDelete = async () => {
    if (!window.confirm('Segur que vols eliminar el grup? Aquesta acció no es pot desfer.')) return
    await deleteGroup(groupId)
    navigate('/')
  }

  const handleArchive = async () => {
    await archiveGroup(groupId)
    navigate(`/group/${groupId}`)
  }

  const handleUnarchive = async () => {
    await unarchiveGroup(groupId)
    navigate(`/group/${groupId}`)
  }

  const handleExport = async () => {
    try {
      await exportGroup(groupId)
      setExportStatus('ok')
    } catch {
      setExportStatus('error')
    } finally {
      setTimeout(() => setExportStatus('idle'), 3000)
    }
  }

  const handleShare = async () => {
    try {
      const encoded = await reparteix.share.encodeGroup(groupId)
      const url = `${window.location.origin}${window.location.pathname}#/import?g=${encoded}`
      const result = await shareUrl({
        title: `Grup ${group.name} · Reparteix`,
        text: `Importa el grup "${group.name}" a Reparteix`,
        url,
      })
      if (result.method === 'cancelled') return
      setShareStatus(result.method === 'clipboard' ? 'copied' : 'shared')
    } catch {
      setShareStatus('error')
    } finally {
      setTimeout(() => setShareStatus('idle'), 3000)
    }
  }

  return (
    <>
      <form onSubmit={handleSave} className="space-y-6">
        <Card className={isArchived ? 'opacity-60 pointer-events-none' : ''}>
          <CardContent className="pt-6 space-y-5">
            {/* Icon */}
            <div className="space-y-2">
              <Label>Icona</Label>
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl shrink-0">
                  {icon || '👥'}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="Escriu un emoji…"
                    maxLength={MAX_ICON_LENGTH}
                    disabled={isArchived}
                  />
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_SHORTCUTS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setIcon(emoji)}
                        className="text-lg hover:bg-muted rounded px-1 py-0.5 transition-colors"
                        aria-label={emoji}
                        disabled={isArchived}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Nom</Label>
              <Input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom del grup"
                required
                disabled={isArchived}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="group-description">
                Descripció{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Per a qui és aquest grup?"
                rows={2}
                disabled={isArchived}
              />
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <Label htmlFor="group-currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isArchived}>
                <SelectTrigger id="group-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="GBP">GBP £</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={isArchived}>
          Desar canvis
        </Button>
        {isArchived && (
          <p className="text-sm text-muted-foreground text-center">
            El grup és arxivat. Desarxiva'l per poder editar la configuració.
          </p>
        )}
      </form>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Còpia de seguretat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Exporta totes les dades del grup (membres, despeses i pagaments) a un fitxer JSON per fer-ne una còpia de seguretat o migrar-les.
          </p>
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
          {exportStatus === 'ok' && (
            <p className="text-sm text-success">Fitxer exportat correctament.</p>
          )}
          {exportStatus === 'error' && (
            <p className="text-sm text-destructive">Error en exportar. Torna-ho a intentar.</p>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compartir per enllaç</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Genera un enllaç per compartir el grup amb una altra persona. L'altra persona podrà previsualitzar i importar-lo al seu dispositiu.
          </p>
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartir grup
          </Button>
          {shareStatus === 'shared' && (
            <p className="text-sm text-success">Enllaç compartit correctament.</p>
          )}
          {shareStatus === 'copied' && (
            <p className="text-sm text-success">Enllaç copiat al porta-retalls.</p>
          )}
          {shareStatus === 'error' && (
            <p className="text-sm text-destructive">Error en generar l'enllaç. Torna-ho a intentar.</p>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregant sincronització…</p>}>
        <SyncPanel groupId={groupId} />
      </Suspense>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arxivar grup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isArchived ? (
            <>
              <p className="text-sm text-muted-foreground">
                El grup està arxivat i és de només lectura. Desarxiva'l per tornar a afegir despeses i fer canvis.
              </p>
              <Button
                variant="outline"
                className="w-full"
                type="button"
                onClick={handleUnarchive}
              >
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Desarxivar grup
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Arxiva el grup per marcar-lo com a tancat. No es podran afegir ni modificar despeses mentre estigui arxivat.
              </p>
              <Button
                variant="outline"
                className="w-full"
                type="button"
                onClick={handleArchive}
              >
                <Archive className="h-4 w-4 mr-2" />
                Arxivar grup
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive text-base">Zona de perill</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            type="button"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar grup
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

export function GroupSettings() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { groups, loadGroups } = useStore()

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const group = groups.find((g) => g.id === groupId)

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/group/${groupId}`)}
          aria-label="Tornar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Configuració</h1>
      </div>

      {group ? (
        <GroupSettingsForm key={group.id} group={group} groupId={groupId!} />
      ) : (
        <p className="text-muted-foreground">Carregant...</p>
      )}
    </div>
  )
}

