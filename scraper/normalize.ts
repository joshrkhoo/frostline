import type { ShopifyProduct } from './shopify.ts'
import type { Store } from './stores.ts'

export type Gender = 'mens' | 'womens' | 'kids' | 'unisex'

/** What a listing is: the marketplace sells boards and bindings. */
export type Kind = 'board' | 'binding'

export interface Size {
  label: string
  cm: number | null
  wide: boolean
  available: boolean
}

export interface Specs {
  profile?: string
  shape?: string
  flex?: string
  level?: string
  terrain: string[]
  /** Bindings: how you get in (Strap, Step On, Hands-free). */
  entry?: string
}

export interface Listing {
  storeId: string
  productId: number
  title: string
  url: string
  brand: string
  model: string
  key: string
  gender: Gender
  category: 'snowboard' | 'splitboard'
  year: number | null
  price: number
  compareAt: number | null
  discount: number
  inStock: boolean
  sizes: Size[]
  images: string[]
  /** Pixel width of the first photo, used to pick the sharpest photo set. */
  imageWidth: number
  specs: Specs
  description: string
}

// Brands whose official styling isn't simple title case.
const BRAND_DISPLAY: Record<string, string> = {
  capita: 'CAPiTA',
  gnu: 'GNU',
  k2: 'K2',
  yes: 'YES.',
  'lib tech': 'Lib Tech',
  dc: 'DC',
  'korua shapes': 'Korua',
  korua: 'Korua',
  'whitespace snowboards': 'Whitespace',
  '32': 'ThirtyTwo',
  thirtytwo: 'ThirtyTwo',
  spark: 'Spark R&D',
  union: 'Union',
  whitespace: 'Whitespace',
  'never summer': 'Never Summer',
  'rome sds': 'Rome',
  rome: 'Rome',
  nidecker: 'Nidecker',
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())

export function brandKey(vendor: string): string {
  return vendor
    .toLowerCase()
    .replace(/\bsnowboards?\b|\bsnowboarding\b|\bshapes\b|\bbinding co(mpany)?\b|\br\s?(&|n)\s?d\b/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function brandDisplay(vendor: string): string {
  const k = vendor.toLowerCase().trim()
  return BRAND_DISPLAY[k] ?? BRAND_DISPLAY[brandKey(vendor)] ?? titleCase(brandKey(vendor) || vendor)
}

const GENDER_WORDS = /\b(men'?s|mens|male|women'?s|womens|wmns|female|w's|kids'?|youth|boys'?|girls'?|unisex|junior|jnr)\b/gi

function detectGender(text: string): Gender {
  const t = text.toLowerCase()
  if (/\b(kids'?|youth|boys'?|girls'?|junior|jnr|grom)\b/.test(t)) return 'kids'
  if (/\b(women'?s|womens|wmns|female|w's|gender_2~female)\b/.test(t) && !/\b(men'?s|mens|male)\b/.test(t)) return 'womens'
  if (/\b(men'?s|mens|male)\b/.test(t) && !/\b(women'?s|womens|female)\b/.test(t)) return 'mens'
  return 'unisex'
}

/** Strips brand, years, sizes, gender and filler words to get the bare model name. */
export function cleanModel(title: string, vendor: string): string {
  let t = title.split('|')[0].replace(/[‘’]/g, "'")
  const vendorWords = [vendor, brandKey(vendor), brandDisplay(vendor)]
  for (const v of vendorWords) {
    if (!v) continue
    t = t.replace(new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ')
  }
  return t
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(19|20)\d{2}(\s*\/\s*\d{2,4})?\b/g, ' ')
    .replace(/\s-\s.*$/, ' ') // "- Kids", "- 161cm", "- Brushed"
    .replace(/\b\d{2,3}\s?(cm|w|wide)?\b/gi, ' ')
    .replace(GENDER_WORDS, ' ')
    .replace(/\bsnow\s?boards?\b/gi, ' ')
    .replace(/\b(new|sale|clearance|demo|ex[- ]?demo)\b/gi, ' ')
    .replace(/^[^a-z0-9]+/i, '') // "YES. Vetta", "Kids' Grom" leave stray punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

/** A binding's bare model: also drops "Bindings" and Burton's "Re:Flex" (the plain version). */
export function cleanBindingModel(title: string, vendor: string): string {
  return cleanModel(title, vendor)
    .replace(/\bbindings?\b|\bre:?\s?flex\b|^r\s?&\s?d\b/gi, ' ')
    .replace(/\bstep-on\b/gi, 'Step On')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Identity used to match the same board across stores. */
export function modelKey(brand: string, model: string): string {
  const m = model
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\bcamber$/, '') // "Counterbalance Camber" == "Counter Balance"
    .replace(/\s+/g, '')
  return `${brandKey(brand).replace(/\s+/g, '-')}--${m}`
}

/**
 * Shops order binding names freely ("Step On Cartel X" / "Cartel X Step On",
 * "FASE Mercury" / "Mercury FASE"), so the key ignores word order.
 */
export function bindingKey(brand: string, model: string): string {
  const words = model
    .toLowerCase()
    .replace(/step on/g, 'stepon')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
  return `${brandKey(brand).replace(/\s+/g, '-')}--${words.join('')}`
}

function tagsOf(p: ShopifyProduct): string[] {
  return (Array.isArray(p.tags) ? p.tags : String(p.tags ?? '').split(','))
    .map((t) => t.trim())
    .filter(Boolean)
}

function detectYear(p: ShopifyProduct, tags: string[]): number | null {
  const fromTitle = p.title.match(/\b(20[1-3]\d)\b/)
  if (fromTitle) return Number(fromTitle[1])
  const years = tags
    .map((t) => t.match(/^(?:year[:/]|season-)?(20\d\d)$/i)?.[1])
    .filter(Boolean)
    .map(Number)
  return years.length ? Math.max(...years) : null
}

function parseSize(label: string): Pick<Size, 'cm' | 'wide'> {
  const m = label.match(/(\d{2,3}(?:\.\d)?)/)
  return { cm: m ? Number(m[1]) : null, wide: /\d\s*(w\b|wide)/i.test(label) || /\bwide\b/i.test(label) }
}

function sizesOf(p: ShopifyProduct): Size[] {
  const idx = p.options.findIndex((o) => /size|length/i.test(o.name))
  const sizes = new Map<string, Size>()
  for (const v of p.variants) {
    const raw = idx === 0 ? v.option1 : idx === 1 ? v.option2 : idx === 2 ? v.option3 : null
    const fallback = /^\d{2,3}/.test(v.title) ? v.title.split('/')[0] : null
    const label = (raw ?? fallback ?? '').replace(/\s*cm$/i, '').trim()
    if (!label || /default/i.test(label)) continue
    const prev = sizes.get(label)
    sizes.set(label, { label, ...parseSize(label), available: (prev?.available ?? false) || v.available })
  }
  return [...sizes.values()].sort((a, b) => (a.cm ?? 0) - (b.cm ?? 0))
}

// Binding sizes, most specific first: "S/M" before "S", "XS/S" before "XS".
const FITS: [RegExp, string][] = [
  [/^(xs\s*\/\s*s)\b/i, 'XS/S'],
  [/^(s\s*\/\s*m|small\s*\/\s*medium)\b/i, 'S/M'],
  [/^(m\s*\/\s*l|medium\s*\/\s*large)\b/i, 'M/L'],
  [/^(l\s*\/\s*xl|large\s*\/\s*x-?large)\b/i, 'L/XL'],
  [/^(x-?small|xs)\b/i, 'XS'],
  [/^(x-?large|xl)\b/i, 'XL'],
  [/^(small|s)\b/i, 'S'],
  [/^(medium|mid|m)\b/i, 'M'],
  [/^(large|l)\b/i, 'L'],
]
export const FIT_ORDER = ['XS', 'XS/S', 'S', 'S/M', 'M', 'M/L', 'L', 'L/XL', 'XL']

/** Binding sizes ("M (US 8-11)", "Medium", "S/M") as XS…XL, from whichever option holds them. */
function bindingSizesOf(p: ShopifyProduct): Size[] {
  const fits = new Map<string, Size>()
  // Read the option named "Size" when there is one; otherwise try every option.
  const idx = p.options.findIndex((o) => /size/i.test(o.name))
  for (const v of p.variants) {
    const options = [v.option1, v.option2, v.option3]
    const parts = idx >= 0 ? [options[idx]] : [...options, ...v.title.split(' / ')]
    for (const part of parts) {
      const fit = part && FITS.find(([re]) => re.test(part.trim()))?.[1]
      if (!fit) continue
      fits.set(fit, { label: fit, cm: null, wide: false, available: (fits.get(fit)?.available ?? false) || v.available })
      break
    }
  }
  return [...fits.values()].sort((a, b) => FIT_ORDER.indexOf(a.label) - FIT_ORDER.indexOf(b.label))
}

const PROFILE_MAP: [RegExp, string][] = [
  [/hybrid\s*rocker|rocker\s*\/\s*camber|flying v|\bc3\b|\bcr\b/i, 'Hybrid Rocker'],
  [/hybrid|combination|directional camber|camrock|\bc2\b|purepop|rocker\/camber/i, 'Hybrid Camber'],
  [/flat/i, 'Flat'],
  [/rocker/i, 'Rocker'],
  [/camber/i, 'Camber'],
]

const SHAPE_MAP: [RegExp, string][] = [
  [/directional twin/i, 'Directional Twin'],
  [/twin/i, 'True Twin'],
  [/directional|tapered/i, 'Directional'],
]

const FLEX_MAP: [RegExp, string][] = [
  [/medium[- ]?stiff|mid[- ]?stiff/i, 'Medium-Stiff'],
  [/soft[- ]?medium|medium[- ]?soft/i, 'Soft-Medium'],
  [/stiff|firm/i, 'Stiff'],
  [/soft/i, 'Soft'],
  [/mid|medium/i, 'Medium'],
]

const TERRAIN_MAP: [RegExp, string][] = [
  [/all[- ]?mountain|resort/i, 'All Mountain'],
  [/park|freestyle|jib/i, 'Freestyle'],
  [/freeride/i, 'Freeride'],
  [/powder|pow\b/i, 'Powder'],
  [/backcountry|splitboard|touring/i, 'Backcountry'],
]

const pick = (value: string, map: [RegExp, string][]) => map.find(([re]) => re.test(value))?.[1]

// Bare tags some stores use (e.g. Melbourne Snowboard Centre: "flat", "twin", "soft").
const PLAIN_TAGS: Record<string, [keyof Omit<Specs, 'terrain' | 'level'> | 'terrain', string]> = {
  camber: ['profile', 'Camber'],
  positive: ['profile', 'Camber'],
  'hybrid-camber': ['profile', 'Hybrid Camber'],
  'hybrid-positive': ['profile', 'Hybrid Camber'],
  'hybrid-rocker': ['profile', 'Hybrid Rocker'],
  rocker: ['profile', 'Rocker'],
  flat: ['profile', 'Flat'],
  twin: ['shape', 'True Twin'],
  'true-twin': ['shape', 'True Twin'],
  'directional-twin': ['shape', 'Directional Twin'],
  directional: ['shape', 'Directional'],
  soft: ['flex', 'Soft'],
  'soft-mid': ['flex', 'Soft-Medium'],
  mid: ['flex', 'Medium'],
  'mid-stiff': ['flex', 'Medium-Stiff'],
  stiff: ['flex', 'Stiff'],
  'all-mountain': ['terrain', 'All Mountain'],
  park: ['terrain', 'Freestyle'],
  freestyle: ['terrain', 'Freestyle'],
  freeride: ['terrain', 'Freeride'],
  powder: ['terrain', 'Powder'],
  backcountry: ['terrain', 'Backcountry'],
}

function specsOf(tags: string[], text: string): Specs {
  const specs: Specs = { terrain: [] }
  const terrain = new Set<string>()
  for (const tag of tags) {
    // Tag schemes seen: "camber-type:Hybrid", "attribute-camber_profile|camber", "Camber_1~Full Camber"
    const [k, v] = tag.split(/[:|~]/).length > 1
      ? [tag.split(/[:|~]/)[0], tag.split(/[:|~]/).slice(1).join(' ')]
      : [tag, tag]
    const key = k.toLowerCase()
    const plain = PLAIN_TAGS[tag.trim().toLowerCase()]
    if (plain) {
      if (plain[0] === 'terrain') terrain.add(plain[1])
      else specs[plain[0]] ??= plain[1]
    } else if (/camber/.test(key)) specs.profile ??= pick(v, PROFILE_MAP)
    else if (/shape/.test(key)) specs.shape ??= pick(v, SHAPE_MAP)
    else if (/flex/.test(key)) specs.flex ??= pick(v, FLEX_MAP)
    else if (/skill|level|ability/.test(key)) specs.level ??= titleCase(v.replace(/[/]/g, ' / '))
    else if (/board-type|categor|style|terrain/.test(key)) {
      const t = pick(v, TERRAIN_MAP)
      if (t) terrain.add(t)
    }
  }
  specs.profile ??= pick(text, PROFILE_MAP)
  specs.shape ??= pick(text, SHAPE_MAP)
  specs.terrain = [...terrain]
  return specs
}

const stripHtml = (html: string | null) =>
  (html ?? '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** How a binding is entered: Step On (Burton, Nitro, Union), hands-free (Flow, Nidecker Supermatic, FASE, Clew) or straps. */
function entryOf(text: string): string {
  if (/step[- ]?on/i.test(text)) return 'Step On'
  if (/supermatic|\bfase\b|\bclew\b|\bflow\b|rear[- ]?entry|hands[- ]?free|clicker/i.test(text)) return 'Hands-free'
  return 'Strap'
}

export function normalize(p: ShopifyProduct, store: Store, kind: Kind = 'board'): Listing {
  const tags = tagsOf(p)
  const brand = brandDisplay(p.vendor || p.title.split(' ')[0])
  const binding = kind === 'binding'
  const model = titleCaseIfShouty(binding ? cleanBindingModel(p.title, p.vendor) : cleanModel(p.title, p.vendor))
  const genderText = `${p.title} ${p.product_type} ${tags.filter((t) => /gender|womens|mens|kids|boys|girls|youth|junior/i.test(t)).join(' ')}`
  const available = p.variants.filter((v) => v.available)
  const priced = available.length ? available : p.variants
  const price = Math.min(...priced.map((v) => Number(v.price)))
  const compares = priced
    .map((v) => Number(v.compare_at_price ?? 0))
    .filter((c) => c > price)
  const compareAt = compares.length ? Math.max(...compares) : null
  const description = stripHtml(p.body_html)
  const gender = detectGender(genderText.replace(/[‘’]/g, "'"))
  const specs = specsOf(tags, `${p.title} ${description.slice(0, 600)}`)
  if (binding) {
    // Board-only specs read off a binding's tags would be noise.
    delete specs.profile
    delete specs.shape
    specs.entry = entryOf(`${p.title} ${p.product_type}`)
  }

  return {
    storeId: store.id,
    productId: p.id,
    title: p.title.replace(/\s*\|\s*/g, ' - ').trim(), // "Flux DS 2026 | Black": keep the colourway apart
    url: `https://${store.domain}/products/${p.handle}`,
    brand,
    model,
    // Women's and kids' bindings are their own models, sized differently.
    key: (binding ? bindingKey(brand, model) : modelKey(brand, model)) + (binding && gender !== 'mens' && gender !== 'unisex' ? `--${gender}` : ''),
    gender,
    category: /splitboard|hitchhiker/i.test(`${p.title} ${p.product_type}`) ? 'splitboard' : 'snowboard',
    year: detectYear(p, tags),
    price,
    compareAt,
    discount: compareAt ? Math.round(((compareAt - price) / compareAt) * 100) : 0,
    inStock: available.length > 0,
    sizes: binding ? bindingSizesOf(p) : sizesOf(p),
    images: p.images.slice(0, 6).map((i) => i.src),
    imageWidth: p.images[0]?.width ?? 0,
    specs,
    description: description.slice(0, 600),
  }
}

const SHORT_WORDS = /^(the|and|for|one|pro|max|air|ace|box|fly|ice|kid|mix|new|big|top|day|sky|sun|zen|ivy|kat|boss|mini|wild)$/i

function titleCaseIfShouty(s: string) {
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s
  // Leave acronyms like "D.O.A." alone, and short model codes ("DS", "STR", "CL-4") in capitals.
  return s
    .split(' ')
    .map((w) => (w.includes('.') || (w.replace(/[^a-z]/gi, '').length <= 3 && !SHORT_WORDS.test(w)) ? w.toUpperCase() : titleCase(w)))
    .join(' ')
}
