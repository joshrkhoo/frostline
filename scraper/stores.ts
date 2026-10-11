export interface Store {
  id: string
  name: string
  domain: string
  location: string
  /** Shopify stores expose a public /products.json catalogue feed. */
  platform: 'shopify'
}

export const STORES: Store[] = [
  { id: 'auski', name: 'Auski', domain: 'auski.com.au', location: 'Melbourne, VIC', platform: 'shopify' },
  { id: 'rhythm', name: 'Rhythm Snowsports', domain: 'rhythmsnowsports.com.au', location: 'Sydney, NSW', platform: 'shopify' },
  { id: 'twelve', name: 'Twelve Board Store', domain: 'twelveboardstore.com.au', location: 'Melbourne, VIC', platform: 'shopify' },
  { id: 'larryadler', name: 'Larry Adler', domain: 'larryadler.com.au', location: 'Sydney, NSW', platform: 'shopify' },
  { id: 'balmoral', name: 'Balmoral Boards', domain: 'balmoralboards.com.au', location: 'Sydney, NSW', platform: 'shopify' },
  { id: 'paulreader', name: 'Paul Reader', domain: 'paulreader.com.au', location: 'Sydney, NSW', platform: 'shopify' },
  { id: 'snowmonkey', name: 'Snow Monkey', domain: 'snowmonkey.com.au', location: 'Melbourne, VIC', platform: 'shopify' },
]
