export interface ShareResult {
  method: 'native-share' | 'clipboard' | 'cancelled'
}

function supportsNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

function isShareAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function shareData(
  data: { title?: string; text?: string; url?: string },
  clipboardText: string,
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

  await navigator.clipboard.writeText(clipboardText)
  return { method: 'clipboard' }
}

export async function shareUrl(
  data: { title?: string; text?: string; url: string },
): Promise<ShareResult> {
  return shareData(data, data.url)
}

export async function shareText(
  data: { title?: string; text: string },
): Promise<ShareResult> {
  return shareData(data, data.text)
}
