import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Users, ChevronRight, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const group = await addGroup(name.trim())
    setName('')
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

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">🧾 Reparteix</h1>
      <p className="text-muted-foreground mb-8">
        Gestiona despeses compartides de forma local i privada.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Nou grup</CardTitle>
          <CardDescription>Crea un grup per compartir despeses o importa'n un des d'un fitxer JSON</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom del grup"
              className="flex-1"
              required
            />
            <Button type="submit">
              <Plus className="h-4 w-4 mr-1" />
              Crear
            </Button>
          </form>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar des de JSON
            </Button>
            {importStatus === 'ok' && (
              <p className="text-sm text-green-600 mt-1">Grup importat correctament. Redirigint…</p>
            )}
            {importStatus === 'error' && (
              <p className="text-sm text-destructive mt-1">
                Error en importar: {importError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Encara no tens cap grup. Crea&apos;n un per començar!
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center p-4">
                <button
                  onClick={() => navigate(`/group/${group.id}`)}
                  className="flex-1 text-left flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl shrink-0">
                    {group.icon ? (
                      group.icon
                    ) : (
                      <Users className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{group.name}</h3>
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
      )}
    </div>
  )
}
