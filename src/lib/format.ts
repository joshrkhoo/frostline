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

export const storeCount = (listings: { storeId: string }[]) => new Set(listings.map((l) => l.storeId)).size
