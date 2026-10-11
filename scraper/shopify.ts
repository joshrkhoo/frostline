export interface ShopifyVariant {
  id: number
  title: string
  price: string
  compare_at_price: string | null
  available: boolean
  option1: string | null
  option2: string | null
  option3: string | null
}

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  vendor: string
  product_type: string
  tags: string[] | string
  body_html: string | null
  options: { name: string; values: string[] }[]
  images: { src: string; width: number; height: number }[]
  variants: ShopifyVariant[]
}

const UA = 'Mozilla/5.0 (compatible; FrostlineBot/0.1; +https://github.com/joshrkhoo/frostline)'
const PAGE_SIZE = 250
const MAX_PAGES = 40

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(domain: string, page: number, attempt = 0): Promise<ShopifyProduct[]> {
  const res = await fetch(`https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
  })
  if (res.status === 429 && attempt < 4) {
    await sleep(2000 * (attempt + 1))
    return fetchPage(domain, page, attempt + 1)
  }
  if (!res.ok) throw new Error(`${domain} page ${page}: HTTP ${res.status}`)
  const json = (await res.json()) as { products: ShopifyProduct[] }
  return json.products
}

/** Walks a Shopify store's public catalogue feed page by page. */
export async function fetchAllProducts(domain: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const products = await fetchPage(domain, page)
    if (!products.length) break
    all.push(...products)
    // Be polite: one request at a time, small gap between pages.
    await sleep(400)
  }
  return all
}
