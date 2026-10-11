import type { Gender, Listing, Specs } from './normalize.ts'

export interface Board {
  id: string
  brand: string
  model: string
  gender: Gender
  category: 'snowboard' | 'splitboard'
  year: number | null
  images: string[]
  specs: Specs
  description: string
  sizes: number[]
  bestPrice: number
  rrp: number
  discount: number
  inStock: boolean
  listings: Omit<Listing, 'key' | 'brand' | 'model' | 'specs' | 'description' | 'imageWidth'>[]
}

const mostCommon = <T>(values: T[]): T => {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

function mergeSpecs(listings: Listing[]): Specs {
  const first = <K extends keyof Specs>(k: K) => listings.map((l) => l.specs[k]).find(Boolean) as Specs[K]
  return {
    profile: first('profile'),
    shape: first('shape'),
    flex: first('flex'),
    level: first('level'),
    terrain: [...new Set(listings.flatMap((l) => l.specs.terrain))],
  }
}

/** Groups store listings of the same board model into one marketplace entry. */
export function groupBoards(listings: Listing[]): Board[] {
  const groups = new Map<string, Listing[]>()
  for (const l of listings) {
    if (!l.model || !Number.isFinite(l.price) || l.price <= 0) continue
    groups.set(l.key, [...(groups.get(l.key) ?? []), l])
  }

  return [...groups.entries()].map(([key, ls]) => {
    // Cheapest in-stock offer first.
    ls.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price)
    const best = ls.find((l) => l.inStock) ?? ls[0]
    // Only compare against the same season so an old model isn't measured
    // against this year's RRP.
    const sameSeason = ls.filter((l) => l.year === null || best.year === null || l.year === best.year)
    const rrp = Math.max(...sameSeason.map((l) => l.compareAt ?? l.price))
    // Prefer the sharpest photo set (stores range from ~680px to 1600px+),
    // then the one with the most photos.
    const imageSource = [...ls].sort(
      (a, b) => Math.min(b.imageWidth, 1600) - Math.min(a.imageWidth, 1600) || b.images.length - a.images.length,
    )[0]
    const genders = ls.map((l) => l.gender).filter((g) => g !== 'unisex')
    const years = ls.map((l) => l.year).filter((y): y is number => y !== null)
    const sizes = [...new Set(ls.flatMap((l) => l.sizes.filter((s) => s.available && s.cm).map((s) => s.cm!)))]

    return {
      id: key,
      brand: mostCommon(ls.map((l) => l.brand)),
      model: mostCommon(ls.map((l) => l.model)),
      gender: genders.length ? mostCommon(genders) : 'unisex',
      category: ls.some((l) => l.category === 'splitboard') ? 'splitboard' : 'snowboard',
      year: years.length ? Math.max(...years) : null,
      images: imageSource.images,
      specs: mergeSpecs(ls),
      description: [...ls].sort((a, b) => b.description.length - a.description.length)[0].description,
      sizes: sizes.sort((a, b) => a - b),
      bestPrice: best.price,
      rrp,
      discount: rrp > best.price ? Math.round(((rrp - best.price) / rrp) * 100) : 0,
      inStock: ls.some((l) => l.inStock),
      listings: ls.map(({ key: _k, brand: _b, model: _m, specs: _s, description: _d, imageWidth: _w, ...rest }) => rest),
    }
  })
}
