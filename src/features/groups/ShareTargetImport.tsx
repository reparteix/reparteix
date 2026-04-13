import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { clearPendingSharedFile, loadPendingSharedFile } from '@/lib/share-target'
import { useStore } from '@/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; groupId: string }

export function ShareTargetImport() {
  const navigate = useNavigate()
  const importGroup = useStore((state) => state.importGroup)
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    const pending = loadPendingSharedFile()

    if (!pending) {
      setState({ status: 'error', message: 'No hi ha cap fitxer compartit pendent.' })
      return
    }

    if (pending.error) {
      clearPendingSharedFile()
      setState({ status: 'error', message: pending.error })
      return
    }

    if (!pending.text) {
      clearPendingSharedFile()
      setState({ status: 'error', message: 'El fitxer compartit no conté dades llegibles.' })
      return
    }

    const text = pending.text

    ;(async () => {
      try {
        const raw: unknown = JSON.parse(text)
        const group = await importGroup(raw)
        clearPendingSharedFile()
        setState({ status: 'done', groupId: group.id })
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'No s\'ha pogut importar el fitxer compartit.',
        })
      }
    })()
  }, [importGroup])

  return (
    <div className="min-h-screen bg-muted/50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Card className="shadow-md">
          <CardContent className="py-10 text-center">
            {state.status === 'loading' && (
              <p className="text-muted-foreground">Important fitxer compartit…</p>
            )}

            {state.status === 'error' && (
              <div className="flex flex-col items-center gap-4">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">No s'ha pogut importar</p>
                  <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Tornar a l'inici
                </Button>
              </div>
            )}

            {state.status === 'done' && (
              <div className="flex flex-col items-center gap-4">
                <p className="font-semibold text-success">Grup importat correctament</p>
                <Button onClick={() => navigate(`/group/${state.groupId}`)}>
                  Veure el grup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
