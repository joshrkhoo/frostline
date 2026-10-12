import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSnowboard } from './classify.ts'
import { groupBoards } from './match.ts'
import { normalize, type Listing } from './normalize.ts'
import type { Board } from '../src/types.ts'
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

/**
 * A store's listings from the last good run, rebuilt from boards.json, so a
 * store that fails today (rate limits, downtime) doesn't vanish from the site.
 */
function previousListings(storeId: string): Listing[] {
  const file = join(outDir, 'boards.json')
  if (!existsSync(file)) return []
  const { boards } = JSON.parse(readFileSync(file, 'utf8')) as { boards: Board[] }
  return boards.flatMap((b) =>
    b.listings
      .filter((l) => l.storeId === storeId)
      .map((l) => ({ ...l, key: b.id, brand: b.brand, model: b.model, specs: b.specs, description: b.description, imageWidth: 0 }) as Listing),
  )
}

async function main() {
  const listings: Listing[] = []
  const storeStats: Record<string, { products: number; boards: number; ok: boolean }> = {}

  await Promise.all(
    STORES.map(async (store) => {
      try {
        const products = await loadStore(store.id, store.domain)
        // Sold-out listings are mostly past seasons' archive pages, so skip them.
        const boards = products
          .filter(isSnowboard)
          .map((p) => normalize(p, store))
          .filter((l) => l.inStock)
        listings.push(...boards)
        storeStats[store.id] = { products: products.length, boards: boards.length, ok: true }
        console.log(`✓ ${store.name.padEnd(20)} ${String(boards.length).padStart(4)} boards / ${products.length} products`)
      } catch (err) {
        const kept = previousListings(store.id)
        listings.push(...kept)
        storeStats[store.id] = { products: 0, boards: kept.length, ok: false }
        console.error(`✗ ${store.name}: ${(err as Error).message} (kept ${kept.length} listings from the last run)`)
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
