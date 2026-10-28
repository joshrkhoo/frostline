const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

export const money = (n: number) => aud.format(Math.round(n))

/** Shopify CDN resizes on the fly via the `width` query param. */
export function sized(src: string, width: number): string {
  if (!src.includes('cdn.shopify.com') && !src.includes('/cdn/shop/')) return src
  const url = new URL(src.startsWith('//') ? `https:${src}` : src)
  url.searchParams.set('width', String(width))
  return url.toString()
}

export const GENDER_LABEL = { mens: "Men's", womens: "Women's", kids: 'Kids', unisex: 'Unisex' } as const

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

/** One label per size across stores: "156cm Wide", "156WIDE", "156W" → "156W". */
export const sizeLabel = (s: { cm: number | null; wide: boolean; label: string }) =>
  s.cm ? `${s.cm}${s.wide ? 'W' : ''}` : s.label.toUpperCase()

/** Binding sizes smallest first; board lengths sort by their cm. */
export const FIT_ORDER = ['XS', 'XS/S', 'S', 'S/M', 'M', 'M/L', 'L', 'L/XL', 'XL']
export const sizeRank = (s: { cm: number | null; label: string }) => s.cm ?? FIT_ORDER.indexOf(s.label.toUpperCase())

/**
 * The colourway in a listing title, for shops that list each colour as its
 * own product: "Union Atlas Bindings - Violet", "Flux DS Binding 2026 | Black".
 */
export function colourOf(title: string): string | null {
  const m = title.match(/\s(?:-|\|)\s([^-|]+?)\s*$/)
  if (!m || /\b(mens|men's|womens|women's|kids|youth|small|medium|large|xs|s|m|l|xl|\d+)\b/i.test(m[1])) return null
  return m[1]
}

export const storeCount = (listings: { storeId: string }[]) => new Set(listings.map((l) => l.storeId)).size
