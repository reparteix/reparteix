export interface ShareResult {
  method: 'native-share' | 'clipboard'
}

function supportsNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export async function shareUrl(
  data: { title?: string; text?: string; url: string },
): Promise<ShareResult> {
  if (supportsNativeShare()) {
    await navigator.share(data)
    return { method: 'native-share' }
  }

  await navigator.clipboard.writeText(data.url)
  return { method: 'clipboard' }
}
