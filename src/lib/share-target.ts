const SHARE_TARGET_KEY = 'reparteix.share-target.pending'

export interface PendingSharedFile {
  name?: string
  type?: string
  text?: string
  error?: string
}

export function loadPendingSharedFile(): PendingSharedFile | null {
  const raw = window.sessionStorage.getItem(SHARE_TARGET_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as PendingSharedFile
  } catch {
    window.sessionStorage.removeItem(SHARE_TARGET_KEY)
    return null
  }
}

export function clearPendingSharedFile(): void {
  window.sessionStorage.removeItem(SHARE_TARGET_KEY)
}
