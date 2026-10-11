import type { ShopifyProduct } from './shopify.ts'

const BOARD_TYPE = /snow\s?boards?|splitboards?/i
// Tag-only stores: "snowboard", "MENS SNOWBOARDS", "JUNIOR SNOWBOARDS"...
const BOARD_TAG = /^((mens|womens|men's|women's|junior|kids|youth)\s+)?(snowboards?|splitboards?)$/i
const NOT_A_BOARD =
  /boot|binding|bag|jacket|pant|glove|mitt|wax|leash|stomp|tool|helmet|goggle|sock|lock|skins?\b|clip|\bkit\b|access|spare|\bparts?\b|puck|crampon|package|bundle|hoodie|tee\b|beanie|sticker|voucher|gift card|rental|service|tune|repair|\bbib\b|overall|shell|fleece|vest|layer|shirt|shorts?\b|hood/i

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
