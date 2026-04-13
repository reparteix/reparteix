export interface ShareResult {
  method: 'native-share' | 'clipboard' | 'cancelled'
}

function supportsNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

function isShareAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function shareUrl(
  data: { title?: string; text?: string; url: string },
): Promise<ShareResult> {
  if (supportsNativeShare()) {
    try {
      await navigator.share(data)
      return { method: 'native-share' }
    } catch (error) {
      if (isShareAbort(error)) {
        return { method: 'cancelled' }
      }
      throw error
    }
  }

  await navigator.clipboard.writeText(data.url)
  return { method: 'clipboard' }
}
