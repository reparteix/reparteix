import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Users, ChevronRight, Upload, Archive, ChevronDown, Settings, MoreHorizontal } from 'lucide-react'
import { ONBOARDING_COMPLETED_KEY } from './OnboardingWizard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { getLocalDeviceIdentity, needsDeviceLabelSetup } from '@/lib/device-identity'

export function GroupList() {
  const { groups, groupTotals, loadGroups, addGroup, deleteGroup, importGroup } = useStore()
  const hasPendingDeviceSetup = needsDeviceLabelSetup(getLocalDeviceIdentity())
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [importError, setImportError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [openGroupMenuId, setOpenGroupMenuId] = useState<string | null>(null)
  const [onboardingCompleted] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createGroupInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  useEffect(() => {
    if (showForm) {
      createGroupInputRef.current?.focus()
    }
  }, [showForm])

  useEffect(() => {
    const handleDocumentClick = () => setOpenGroupMenuId(null)
    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  const handleCancel = () => {
    setShowForm(false)
    setName('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const group = await addGroup(name.trim())
    setName('')
    setShowForm(false)
    navigate(`/group/${group.id}`)
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-selected after an error
    e.target.value = ''
    try {
      const text = await file.text()
      const raw = JSON.parse(text)
      const group = await importGroup(raw)
      setImportStatus('ok')
      setImportError('')
      setTimeout(() => {
        setImportStatus('idle')
        navigate(`/group/${group.id}`)
      }, 1500)
    } catch (err) {
      setImportStatus('error')
      setImportError(err instanceof Error ? err.message : 'Format invàlid')
      setTimeout(() => setImportStatus('idle'), 4000)
    }
  }

  const activeGroups = groups.filter((g) => !g.archived)
  const archivedGroups = groups.filter((g) => g.archived)
  const hasGroups = groups.length > 0

  const renderGroupCard = (group: (typeof groups)[number]) => (
    <Card
      key={group.id}
      className={`hover:shadow-md transition-shadow duration-150 ${group.archived ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={() => navigate(`/group/${group.id}`)}
          className="min-w-0 flex-1 text-left flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 text-xl shrink-0">
            {group.icon ? (
              group.icon
            ) : (
              <Users className="h-5 w-5 text-indigo-400 dark:text-indigo-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="font-semibold leading-tight break-words line-clamp-2">{group.name}</h3>
              {group.archived && (
                <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                  Arxivat
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.members.filter((m) => !m.deleted).length} membres
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1 text-right">
            <Badge variant="secondary">{group.currency}</Badge>
            {(groupTotals[group.id] ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground max-w-[88px] break-words">
                {groupTotals[group.id].toFixed(2)}&nbsp;{group.currency}
              </span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        <div className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Més accions del grup"
            aria-haspopup="menu"
            aria-expanded={openGroupMenuId === group.id}
            aria-controls={`group-actions-${group.id}`}
            className="text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation()
              setOpenGroupMenuId((current) => (current === group.id ? null : group.id))
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          {openGroupMenuId === group.id && (
            <div
              id={`group-actions-${group.id}`}
              role="menu"
              aria-label={`Accions per a ${group.name}`}
              className="absolute right-0 top-10 z-20 min-w-[11rem] rounded-xl border bg-popover p-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setOpenGroupMenuId(null)
                }
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenGroupMenuId(null)
                  navigate(`/group/${group.id}/settings`)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Configuració
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setOpenGroupMenuId(null)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-muted"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar grup</AlertDialogTitle>
                    <AlertDialogDescription>
                      Estàs segur que vols eliminar el grup &quot;{group.name}&quot;? Aquesta acció no es pot desfer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteGroup(group.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </Card>
  )

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Hero / Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-800 dark:to-indigo-950 text-white px-4 pt-10 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2">🧾 Reparteix</h1>
              <p className="text-indigo-200 text-base">
                Despeses compartides sense complicacions, sense comptes i amb les dades sota control.
              </p>
            </div>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => navigate('/preferences')}
              aria-label={hasPendingDeviceSetup ? 'Preferències, configuració pendent' : 'Preferències'}
              className="relative shrink-0 bg-white/10 text-white hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <Settings className="h-4 w-4" />
              {hasPendingDeviceSetup && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-400 ring-2 ring-indigo-700 dark:ring-indigo-950"
                  aria-hidden="true"
                />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 pb-12">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".reparteix.json,.json,application/json,application/vnd.reparteix+json"
          className="hidden"
          onChange={handleImportFile}
        />

        {hasGroups ? (
          <>
            {/* Compact create-group panel */}
            <Card className="mb-6 shadow-md">
              <div className="p-4">
                {showForm ? (
                  <form onSubmit={handleCreate} className="flex gap-2">
                    <Input
                      ref={createGroupInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nom del nou grup…"
                      className="flex-1"
                      required
                    />
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shrink-0">
                      <Plus className="h-4 w-4 mr-1" />
                      Crear
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancel}
                      className="shrink-0 text-muted-foreground"
                    >
                      Cancel·lar
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={() => setShowForm(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Nou grup
                    </Button>
                    {!onboardingCompleted && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/onboarding')}
                        className="gap-1.5"
                      >
                        Començar en 1 minut
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-muted-foreground gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Recuperar des d’un fitxer
                    </Button>
                  </div>
                )}
                {/* Import status messages */}
                {importStatus === 'ok' && (
                  <p className="text-sm text-success mt-2">Grup recuperat correctament. Redirigint…</p>
                )}
                {importStatus === 'error' && (
                  <p className="text-sm text-destructive mt-2">Error en recuperar el grup: {importError}</p>
                )}
              </div>
            </Card>

            {/* Active groups list */}
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Els teus grups
              </h2>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {activeGroups.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {activeGroups.map(renderGroupCard)}
            </div>

            {/* Archived groups section */}
            {archivedGroups.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors mb-3"
                >
                  <Archive className="h-4 w-4" />
                  Grups arxivats
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 normal-case font-normal">
                    {archivedGroups.length}
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showArchived ? 'rotate-180' : ''}`}
                  />
                </button>
                {showArchived && (
                  <div className="space-y-3">
                    {archivedGroups.map(renderGroupCard)}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <Card className="shadow-md mt-2">
            <div className="flex flex-col items-center text-center py-14 px-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 mb-5 text-4xl">
                👥
              </div>
              <h2 className="text-xl font-bold mb-2">Crea el teu primer grup</h2>
              <p className="text-muted-foreground text-sm mb-8 max-w-xs">
                Afegeix la gent, apunta la primera despesa i comença a veure el balanç sense embolics. Si ja el tens guardat, també el pots recuperar des d’un fitxer.
              </p>

              {showForm ? (
                <form onSubmit={handleCreate} className="w-full max-w-sm flex flex-col gap-3">
                  <Input
                    ref={createGroupInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom del grup…"
                    required
                  />
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Crear grup
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancel}
                    className="text-muted-foreground"
                  >
                    Cancel·lar
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                  <Button
                    onClick={() => setShowForm(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white w-full"
                    size="lg"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Crear grup
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-muted-foreground gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Recuperar des d’un fitxer
                  </Button>
                </div>
              )}

              {/* Import status messages */}
              {importStatus === 'ok' && (
                <p className="text-sm text-success mt-4">Grup recuperat correctament. Redirigint…</p>
              )}
              {importStatus === 'error' && (
                <p className="text-sm text-destructive mt-4">Error en recuperar el grup: {importError}</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
