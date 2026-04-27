const DEFAULT_LOCALE = 'ca-ES'

function getSafeLocale(locale?: string): string {
  return locale?.trim() || DEFAULT_LOCALE
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: string,
): string {
  return new Intl.NumberFormat(getSafeLocale(locale), options).format(value)
}

export function formatMoney(value: number, currency = 'EUR', locale?: string): string {
  try {
    return formatNumber(
      value,
      {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
      locale,
    )
  } catch {
    return `${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale)} ${currency}`
  }
}

export function formatPercent(value: number, maximumFractionDigits = 1, locale?: string): string {
  return formatNumber(
    value,
    {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits,
    },
    locale,
  )
}

export function parseLocaleNumber(value: string): number {
  const trimmed = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/€/g, '')

  if (!trimmed) return Number.NaN

  const normalized = trimmed.includes(',') && trimmed.includes('.')
    ? trimmed.replace(/\./g, '').replace(/,/g, '.')
    : trimmed.includes(',')
      ? trimmed.replace(/,/g, '.')
      : trimmed

  return Number(normalized)
}

export function formatDecimalInput(value: number): string {
  if (!Number.isFinite(value)) return ''
  return String(value).replace('.', ',')
}
