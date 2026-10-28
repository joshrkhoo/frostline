import type { ShopifyProduct } from './shopify.ts'

const BOARD_TYPE = /snow\s?boards?|splitboards?/i
// Tag-only stores: "snowboard", "MENS SNOWBOARDS", "JUNIOR SNOWBOARDS"...
const BOARD_TAG = /^((mens|womens|men's|women's|junior|kids|youth)\s+)?(snowboards?|splitboards?)$/i
const NOT_A_BOARD =
  /boot|binding|bag|jacket|pant|glove|mitt|wax|leash|stomp|tool|helmet|goggle|sock|lock|skins?\b|clip|\bkit\b|access|spare|\bparts?\b|puck|crampon|package|bundle|hoodie|tee\b|beanie|sticker|voucher|gift card|rental|service|tune|repair|\bbib\b|overall|shell|fleece|vest|layer|shirt|shorts?\b|hood|roller|hardside|case\b|cover/i

/**
 * True when a Shopify product is an actual snowboard or splitboard,
 * not boots, bindings, outerwear or accessories filed under "snowboard".
 */
export function isSnowboard(p: ShopifyProduct): boolean {
  const type = p.product_type ?? ''
  const title = p.title ?? ''
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? '').split(',')
  // Stores with a generic "Boards" type or no type at all mark boards with tags instead.
  const genericType = !type.trim() || /^boards?$/i.test(type.trim())
  const tagged = genericType && tags.some((t) => BOARD_TAG.test(t.trim()))
  if (!BOARD_TYPE.test(type) && !tagged) return false
  if (NOT_A_BOARD.test(`${type} ${title}`)) return false
  // Some stores (e.g. Twelve) file everything snow-related under a generic
  // "Snowboard" type, so require the title to say board as well.
  if (/^snowboards?$/i.test(type.trim()) && !/snowboard|splitboard/i.test(title)) return false
  return p.variants.length > 0
}

// Shops file bindings as "Snowboard Bindings", "Mens Bindings", "Bindings", or
// tag them "MENS SNOWBOARD BINDINGS" with no type at all.
const BINDING_TYPE = /\bbindings?\b/i
// Tags must say snowboard: a bare "JUNIOR BINDINGS" tag also covers ski bindings.
const BINDING_TAG = /^((mens|womens|men's|women's|junior|kids|youth)\s+)?snowboard\s+bindings?$/i
// Ski, wake and touring bindings share the word; so do spare parts and packages.
const NOT_A_SNOWBOARD_BINDING =
  /\bskis?\b|wake|water|slalom|nordic|cross country|telemark|\bntn\b|alpine touring|\bat\b binding|access|hardware|spare|\bparts?\b|screw|disc\b|highback|ratchet|buckle|toe ?(cap|strap)|ankle strap|\bstraps?\b|ladder|leash|stomp|tool|bag\b|package|bundle|\bw\/|with .*(board|ski)|\bkit\b|crampon|riser|puck|gift card|voucher|sticker|\bboots?\b|\bgw\b|grip ?walk|\bdin\b|marker|tyrolia|atomic|look pivot/i

/**
 * True when a Shopify product is a snowboard (or splitboard) binding, not a
 * ski, wakeboard or touring binding, a spare part, or a board package.
 */
export function isBinding(p: ShopifyProduct): boolean {
  const type = (p.product_type ?? '').trim()
  const title = p.title ?? ''
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? '').split(',')
  const typed = BINDING_TYPE.test(type)
  // Twelve files every snow product under a generic "Snowboard" type.
  const generic = /^snowboards?$/i.test(type) && /\bbindings?\b/i.test(title)
  const tagged = !type && tags.some((t) => BINDING_TAG.test(t.trim()))
  if (!typed && !generic && !tagged) return false
  if (NOT_A_SNOWBOARD_BINDING.test(`${type} ${title}`)) return false
  return p.variants.length > 0
}
