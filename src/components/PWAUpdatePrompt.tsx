import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdatePrompt() {
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        intervalRef.current = setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
      console.log(`SW registered: ${swUrl}`)
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg">
      <p className="text-sm font-medium">
        Hi ha una nova versió disponible.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => updateServiceWorker(true)}
        >
          Actualitza
        </button>
        <button
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          onClick={() => setNeedRefresh(false)}
        >
          Més tard
        </button>
      </div>
    </div>
  )
}
