import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBinding, isSnowboard } from './classify.ts'
import { groupBoards } from './match.ts'
import { normalize, type Kind, type Listing } from './normalize.ts'
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

const FILES: Record<Kind, string> = { board: 'boards.json', binding: 'bindings.json' }

/**
 * A store's listings from the last good run, rebuilt from the output file, so
 * a store that fails today (rate limits, downtime) doesn't vanish from the site.
 */
function previousListings(storeId: string, kind: Kind): Listing[] {
  const file = join(outDir, FILES[kind])
  if (!existsSync(file)) return []
  const { boards } = JSON.parse(readFileSync(file, 'utf8')) as { boards: Board[] }
  return boards.flatMap((b) =>
    b.listings
      .filter((l) => l.storeId === storeId)
      .map((l) => ({ ...l, key: b.id, brand: b.brand, model: b.model, specs: b.specs, description: b.description, imageWidth: 0 }) as Listing),
  )
}

async function main() {
  const listings: Record<Kind, Listing[]> = { board: [], binding: [] }
  const storeStats: Record<string, { products: number; ok: boolean } & Record<Kind, number>> = {}

  await Promise.all(
    STORES.map(async (store) => {
      try {
        const products = await loadStore(store.id, store.domain)
        // Sold-out listings are mostly past seasons' archive pages, so skip them.
        const pick = (test: (p: ShopifyProduct) => boolean, kind: Kind) =>
          products
            .filter(test)
            .map((p) => normalize(p, store, kind))
            .filter((l) => l.inStock)
        const boards = pick(isSnowboard, 'board')
        const bindings = pick(isBinding, 'binding')
        listings.board.push(...boards)
        listings.binding.push(...bindings)
        storeStats[store.id] = { products: products.length, board: boards.length, binding: bindings.length, ok: true }
        console.log(
          `✓ ${store.name.padEnd(20)} ${String(boards.length).padStart(4)} boards ${String(bindings.length).padStart(4)} bindings / ${products.length} products`,
        )
      } catch (err) {
        const board = previousListings(store.id, 'board')
        const binding = previousListings(store.id, 'binding')
        listings.board.push(...board)
        listings.binding.push(...binding)
        storeStats[store.id] = { products: 0, board: board.length, binding: binding.length, ok: false }
        console.error(`✗ ${store.name}: ${(err as Error).message} (kept ${board.length} boards, ${binding.length} bindings from the last run)`)
      }
    }),
  )

  mkdirSync(outDir, { recursive: true })
  const updatedAt = new Date().toISOString()
  for (const kind of ['board', 'binding'] as Kind[]) {
    const items = groupBoards(listings[kind], kind).sort((a, b) => b.discount - a.discount || a.bestPrice - b.bestPrice)
    const multiStore = items.filter((b) => new Set(b.listings.map((l) => l.storeId)).size > 1).length
    // Both files share one shape: `boards` holds the items, `stores[].boards` their count per store.
    writeFileSync(
      join(outDir, FILES[kind]),
      JSON.stringify({
        updatedAt,
        stores: STORES.map((s) => ({ ...s, products: storeStats[s.id].products, boards: storeStats[s.id][kind], ok: storeStats[s.id].ok })),
        boards: items,
      }),
    )
    console.log(`${items.length} ${kind}s (${multiStore} sold at 2+ stores) from ${listings[kind].length} listings → public/data/${FILES[kind]}`)
  }
}

main()
