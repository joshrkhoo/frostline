export type Gender = 'mens' | 'womens' | 'kids' | 'unisex'

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
}

export interface Listing {
  storeId: string
  productId: number
  title: string
  url: string
  gender: Gender
  category: 'snowboard' | 'splitboard'
  year: number | null
  price: number
  compareAt: number | null
  discount: number
  inStock: boolean
  sizes: Size[]
  images: string[]
}

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
  listings: Listing[]
}

export interface Store {
  id: string
  name: string
  domain: string
  location: string
  products: number
  boards: number
  ok: boolean
}

export interface MarketData {
  updatedAt: string
  stores: Store[]
  boards: Board[]
}
