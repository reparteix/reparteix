import { useState, useEffect, useCallback, useRef } from 'react'
import { createSyncSession, type SyncSessionStatus, type SyncSessionState } from '../infra/sync/sync-session'
import type { SyncConfigOverrides } from '../infra/sync/config'
import type { SyncReport } from '../domain/services/sync'

export interface UseSyncOptions {
  groupId: string
  passphrase: string
  configOverrides?: SyncConfigOverrides
  autoRetryEnabled?: boolean
  autoRetryMs?: number
}

export interface UseSyncReturn {
  /** Current state of the sync session */
  state: SyncSessionState
  /** Local peer ID (available after connecting to signaling server) */
  peerId: string | null
  /** Last remote peer ID seen by the session */
  remotePeerId: string | null
  /** All remote peers currently known by the session */
  remotePeerIds: string[]
  /** Human-readable status message */
  message: string
  /** Error message if state is 'error' */
  error: string | null
  /** Sync report with details of what changed */
  report: SyncReport | null
  /** Last sync attempt timestamp */
  lastAttemptAt: string | null
  /** Last successful sync timestamp */
  lastSuccessAt: string | null
  /** Whether automatic retry is currently armed */
  autoRetryEnabled: boolean
  /** Sync v2 primary entry point: create room or join existing one */
  startSync: () => Promise<void>
  /** Start as host — create a room and wait for peer */
  startAsHost: () => Promise<void>
  /** Join an existing session as guest */
  joinSession: () => Promise<void>
  /** Reset the session (for retry) */
  reset: () => void
}

export function useSync({
  groupId,
  passphrase,
  configOverrides,
  autoRetryEnabled = false,
  autoRetryMs = 15000,
}: UseSyncOptions): UseSyncReturn {
  const [status, setStatus] = useState<SyncSessionStatus>({
    state: 'idle',
    peerId: null,
    remotePeerId: null,
    remotePeerIds: [],
    groupId,
    passphrase,
    error: null,
    report: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    message: '',
  })

  const sessionRef = useRef<ReturnType<typeof createSyncSession> | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const retryInFlightRef = useRef(false)

  // Clean up on unmount or when key params change
  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearInterval(retryTimerRef.current)
        retryTimerRef.current = null
      }
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
  }, [groupId, passphrase, configOverrides])

  const ensureSession = useCallback(() => {
    if (!sessionRef.current) {
      const session = createSyncSession(groupId, passphrase, configOverrides)
      session.subscribe(setStatus)
      sessionRef.current = session
    }
    return sessionRef.current
  }, [groupId, passphrase, configOverrides])

  const startSync = useCallback(async () => {
    const session = ensureSession()
    await session.startSync()
  }, [ensureSession])

  const startAsHost = useCallback(async () => {
    const session = ensureSession()
    await session.startAsHost()
  }, [ensureSession])

  const joinSession = useCallback(async () => {
    const session = ensureSession()
    await session.joinSession()
  }, [ensureSession])

  const reset = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearInterval(retryTimerRef.current)
      retryTimerRef.current = null
    }
    sessionRef.current?.destroy()
    sessionRef.current = null
    setStatus({
      state: 'idle',
      peerId: null,
      remotePeerId: null,
      remotePeerIds: [],
      groupId,
      passphrase,
      error: null,
      report: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      message: '',
    })
  }, [groupId, passphrase])

  useEffect(() => {
    if (!autoRetryEnabled) {
      if (retryTimerRef.current !== null) {
        window.clearInterval(retryTimerRef.current)
        retryTimerRef.current = null
      }
      return
    }

    if (retryTimerRef.current !== null) return

    retryTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      if (retryInFlightRef.current) return
      if (passphrase.trim().length < 4) return

      const shouldRetry = status.state === 'error' || status.state === 'completed'
      if (!shouldRetry) return

      retryInFlightRef.current = true
      void (async () => {
        try {
          reset()
          const session = ensureSession()
          await session.startSync()
        } catch {
          // surfaced by session status
        } finally {
          retryInFlightRef.current = false
        }
      })()
    }, autoRetryMs)

    return () => {
      if (retryTimerRef.current !== null) {
        window.clearInterval(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [autoRetryEnabled, autoRetryMs, ensureSession, passphrase, reset, status.state])

  return {
    state: status.state,
    peerId: status.peerId,
    remotePeerId: status.remotePeerId,
    remotePeerIds: status.remotePeerIds,
    message: status.message,
    error: status.error,
    report: status.report,
    lastAttemptAt: status.lastAttemptAt,
    lastSuccessAt: status.lastSuccessAt,
    autoRetryEnabled,
    startSync,
    startAsHost,
    joinSession,
    reset,
  }
}
