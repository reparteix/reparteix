import { useEffect, useState } from 'react'
import { useStore } from '../store'

interface FileHandlerResult {
  status: 'idle' | 'importing' | 'ok' | 'error'
  groupId?: string
  error?: string
}

/** Maximum file size accepted for import (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Hook that consumes files delivered via the File Handling API (launchQueue)
 * when the PWA is opened with a `.reparteix.json` file.
 * Only works on installed PWAs in Chromium-based browsers.
 */
export function useFileHandler(): FileHandlerResult {
  const [result, setResult] = useState<FileHandlerResult>({ status: 'idle' })
  const { importGroup } = useStore()

  useEffect(() => {
    if (!('launchQueue' in window)) return

    const queue = (window as unknown as { launchQueue: LaunchQueue }).launchQueue
    queue.setConsumer(async (params: LaunchParams) => {
      if (!params.files?.length) return

      setResult({ status: 'importing' })
      try {
        const fileHandle = params.files[0]
        const file = await fileHandle.getFile()
        if (file.size > MAX_FILE_SIZE) {
          throw new Error('El fitxer és massa gran (màxim 10 MB)')
        }
        const text = await file.text()
        const raw: unknown = JSON.parse(text)
        const group = await importGroup(raw)
        setResult({ status: 'ok', groupId: group.id })
      } catch (err) {
        setResult({
          status: 'error',
          error: err instanceof Error ? err.message : 'Error en importar el fitxer',
        })
      }
    })
  }, [importGroup])

  return result
}

// Type declarations for the File Handling API (not yet in standard lib)
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void
}

interface LaunchParams {
  files?: FileSystemFileHandle[]
}
