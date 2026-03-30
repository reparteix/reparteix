import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Users, ChevronRight, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

export function GroupList() {
  const { groups, groupTotals, loadGroups, addGroup, deleteGroup, importGroup } = useStore()
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [importError, setImportError] = useState('')
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

  const hasGroups = groups.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero / Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white px-4 pt-10 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-2">🧾 Reparteix</h1>
          <p className="text-indigo-200 text-base">
            Gestiona despeses compartides de forma senzilla, local i privada.
          </p>
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
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
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
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setShowForm(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Nou grup
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-muted-foreground gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Importar
                    </Button>
                  </div>
                )}
                {/* Import status messages */}
                {importStatus === 'ok' && (
                  <p className="text-sm text-green-600 mt-2">Grup importat correctament. Redirigint…</p>
                )}
                {importStatus === 'error' && (
                  <p className="text-sm text-destructive mt-2">Error en importar: {importError}</p>
                )}
              </div>
            </Card>

            {/* Groups list */}
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Els teus grups
              </h2>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {groups.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="hover:shadow-md transition-shadow duration-150"
                >
                  <div className="flex items-center p-4">
                    <button
                      onClick={() => navigate(`/group/${group.id}`)}
                      className="flex-1 text-left flex items-center gap-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-xl shrink-0">
                        {group.icon ? (
                          group.icon
                        ) : (
                          <Users className="h-5 w-5 text-indigo-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {group.members.filter((m) => !m.deleted).length} membres
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 mr-1">
                        <Badge variant="secondary">{group.currency}</Badge>
                        {(groupTotals[group.id] ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {groupTotals[group.id].toFixed(2)}&nbsp;{group.currency}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                    </button>
                    <Separator orientation="vertical" className="mx-2 h-8" />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar grup"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                </Card>
              ))}
            </div>
          </>
        ) : (
          /* Empty state */
          <Card className="shadow-md mt-2">
            <div className="flex flex-col items-center text-center py-14 px-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 mb-5 text-4xl">
                👥
              </div>
              <h2 className="text-xl font-bold mb-2">Crea el teu primer grup</h2>
              <p className="text-muted-foreground text-sm mb-8 max-w-xs">
                Afegeix persones i comença a registrar despeses compartides de manera senzilla.
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
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
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
                    Importar des de fitxer
                  </Button>
                </div>
              )}

              {/* Import status messages */}
              {importStatus === 'ok' && (
                <p className="text-sm text-green-600 mt-4">Grup importat correctament. Redirigint…</p>
              )}
              {importStatus === 'error' && (
                <p className="text-sm text-destructive mt-4">Error en importar: {importError}</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
