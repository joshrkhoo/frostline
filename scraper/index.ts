import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSnowboard } from './classify.ts'
import { groupBoards } from './match.ts'
import { normalize, type Listing } from './normalize.ts'
import { fetchAllProducts, type ShopifyProduct } from './shopify.ts'
import { STORES } from './stores.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, '.cache')
const outDir = join(root, 'public', 'data')
// `--cached` reuses the last raw download instead of hitting the stores again.
const useCache = process.argv.includes('--cached')

async function loadStore(id: string, domain: string): Promise<ShopifyProduct[]> {
  const cacheFile = join(cacheDir, `raw-${id}.json`)
  if (useCache && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'))
  const products = await fetchAllProducts(domain)
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(products))
  return products
}

async function main() {
  const listings: Listing[] = []
  const storeStats: Record<string, { products: number; boards: number; ok: boolean }> = {}

  await Promise.all(
    STORES.map(async (store) => {
      try {
        const products = await loadStore(store.id, store.domain)
        const boards = products.filter(isSnowboard).map((p) => normalize(p, store))
        listings.push(...boards)
        storeStats[store.id] = { products: products.length, boards: boards.length, ok: true }
        console.log(`✓ ${store.name.padEnd(20)} ${String(boards.length).padStart(4)} boards / ${products.length} products`)
      } catch (err) {
        storeStats[store.id] = { products: 0, boards: 0, ok: false }
        console.error(`✗ ${store.name}: ${(err as Error).message}`)
      }
    }),
  )

  const boards = groupBoards(listings).sort((a, b) => b.discount - a.discount || a.bestPrice - b.bestPrice)
  const multiStore = boards.filter((b) => new Set(b.listings.map((l) => l.storeId)).size > 1).length

  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    join(outDir, 'boards.json'),
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      stores: STORES.map((s) => ({ ...s, ...storeStats[s.id] })),
      boards,
    }),
  )
  console.log(`\n${boards.length} boards (${multiStore} sold at 2+ stores) from ${listings.length} listings → public/data/boards.json`)
}

main()
