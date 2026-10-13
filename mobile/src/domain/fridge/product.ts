import type { LocationValue } from './location.js'

/** Structurally identical to the backend's `ProductDto` (`product.dto.ts`) — no re-mapping on this side. */
export interface Product {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  location: LocationValue
  expiresAt: string | null
  openedAt: string | null
  category: string
  categories: string[] | null
  openfoodfactId: string | null
  receiptId: string | null
  price: number | null
  imageKey: string | null
  createdAt: string
  updatedAt: string
}

/** Mirrors `createProductValidator` (`product.validator.ts`) field-for-field. */
export interface CreateProductInput {
  name: string
  quantity: { amount: number; unit: string }
  location: LocationValue
  category: string
  expiresAt?: string | null
  openedAt?: string | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}

/** Mirrors `updateProductValidator` — every field optional, `null` allowed where the backend allows clearing it. */
export interface UpdateProductInput {
  expectedUpdatedAt?: string
  name?: string
  quantity?: { amount: number; unit: string }
  location?: LocationValue
  category?: string
  expiresAt?: string | null
  openedAt?: string | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}
