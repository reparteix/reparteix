export interface DeviceIdentity {
  deviceId: string
  deviceLabel: string
}

const STORAGE_KEY = 'reparteix:device-identity:v1'
const DEVICE_LABEL_PREFIX = 'Dispositiu'
const DEFAULT_ACTOR = 'local'

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function generateDeviceId(): string {
  return crypto.randomUUID()
}

function getShortDeviceSuffix(deviceId: string): string {
  return deviceId.replace(/-/g, '').slice(0, 4).toLowerCase()
}

export function getDefaultDeviceLabel(deviceId: string): string {
  return `${DEVICE_LABEL_PREFIX} ${getShortDeviceSuffix(deviceId)}`
}

function normalizeDeviceIdentity(value: unknown): DeviceIdentity | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<DeviceIdentity>
  const deviceId = typeof candidate.deviceId === 'string' ? candidate.deviceId.trim() : ''
  if (!deviceId) return null

  const deviceLabel = typeof candidate.deviceLabel === 'string' && candidate.deviceLabel.trim()
    ? candidate.deviceLabel.trim()
    : getDefaultDeviceLabel(deviceId)

  return { deviceId, deviceLabel }
}

function readStoredDeviceIdentity(): DeviceIdentity | null {
  if (!canUseLocalStorage()) return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeDeviceIdentity(JSON.parse(raw))
  } catch {
    return null
  }
}

function persistDeviceIdentity(identity: DeviceIdentity): DeviceIdentity {
  if (!canUseLocalStorage()) return identity

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // ignore persistence failures
  }

  return identity
}

export function ensureLocalDeviceIdentity(): DeviceIdentity {
  const existing = readStoredDeviceIdentity()
  if (existing) {
    return persistDeviceIdentity(existing)
  }

  const deviceId = generateDeviceId()
  return persistDeviceIdentity({
    deviceId,
    deviceLabel: getDefaultDeviceLabel(deviceId),
  })
}

export function getLocalDeviceIdentity(): DeviceIdentity {
  return ensureLocalDeviceIdentity()
}

export function updateLocalDeviceLabel(nextLabel: string): DeviceIdentity {
  const current = ensureLocalDeviceIdentity()
  const trimmed = nextLabel.trim()

  return persistDeviceIdentity({
    ...current,
    deviceLabel: trimmed || getDefaultDeviceLabel(current.deviceId),
  })
}

export function resetLocalDeviceLabel(): DeviceIdentity {
  const current = ensureLocalDeviceIdentity()
  return persistDeviceIdentity({
    ...current,
    deviceLabel: getDefaultDeviceLabel(current.deviceId),
  })
}

export function getLocalActorLabel(): string {
  try {
    return ensureLocalDeviceIdentity().deviceLabel
  } catch {
    return DEFAULT_ACTOR
  }
}
