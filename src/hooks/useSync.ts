import { useState, useEffect, useCallback, useRef } from 'react'
import { createSyncSession, type SyncSessionStatus, type SyncSessionState } from '../infra/sync/sync-session'
import type { SyncConfigOverrides } from '../infra/sync/config'
import type { SyncReport } from '../domain/services/sync'

export interface UseSyncOptions {
  groupId: string
  passphrase: string
  configOverrides?: SyncConfigOverrides
}

export interface UseSyncReturn {
  /** Current state of the sync session */
  state: SyncSessionState
  /** Local peer ID (available after connecting to signaling server) */
  peerId: string | null
  /** Remote peer ID (available after peer connects) */
  remotePeerId: string | null
  /** Human-readable status message */
  message: string
  /** Error message if state is 'error' */
  error: string | null
  /** Sync report with details of what changed */
  report: SyncReport | null
  /** Start as host — create a room and wait for peer */
  startAsHost: () => Promise<void>
  /** Join an existing session as guest */
  joinSession: () => Promise<void>
  /** Reset the session (for retry) */
  reset: () => void
}

export function useSync({ groupId, passphrase, configOverrides }: UseSyncOptions): UseSyncReturn {
  const [status, setStatus] = useState<SyncSessionStatus>({
    state: 'idle',
    peerId: null,
    remotePeerId: null,
    groupId,
    passphrase,
    error: null,
    report: null,
    message: '',
  })

  const sessionRef = useRef<ReturnType<typeof createSyncSession> | null>(null)

  // Clean up on unmount or when key params change
  useEffect(() => {
    return () => {
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
  }, [groupId, passphrase])

  const ensureSession = useCallback(() => {
    if (!sessionRef.current) {
      const session = createSyncSession(groupId, passphrase, configOverrides)
      session.subscribe(setStatus)
      sessionRef.current = session
    }
    return sessionRef.current
  }, [groupId, passphrase, configOverrides])

  const startAsHost = useCallback(async () => {
    const session = ensureSession()
    await session.startAsHost()
  }, [ensureSession])

  const joinSession = useCallback(async () => {
    const session = ensureSession()
    await session.joinSession()
  }, [ensureSession])

  const reset = useCallback(() => {
    sessionRef.current?.destroy()
    sessionRef.current = null
    setStatus({
      state: 'idle',
      peerId: null,
      remotePeerId: null,
      groupId,
      passphrase,
      error: null,
      report: null,
      message: '',
    })
  }, [groupId, passphrase])

  return {
    state: status.state,
    peerId: status.peerId,
    remotePeerId: status.remotePeerId,
    message: status.message,
    error: status.error,
    report: status.report,
    startAsHost,
    joinSession,
    reset,
  }
}
