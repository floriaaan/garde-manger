import type { LocationValue } from './location.js'
import type { Product } from './product.js'

export type OutcomeKind = 'consumed' | 'discarded'

export type DiscardReason = 'expired' | 'spoiled' | 'disliked' | 'other'

export const DISCARD_REASONS: readonly DiscardReason[] = ['expired', 'spoiled', 'disliked', 'other']

/** Mirrors `recordProductOutcomeValidator` (`product.validator.ts`). `amount` omitted = the whole stock. */
export interface RecordProductOutcomeInput {
  kind: OutcomeKind
  amount?: number
  discardReason?: DiscardReason | null
  /** Reuse for retries of the same explicit quantity; never for a new consumption. */
  operationId?: string
}

/** Structurally identical to the backend's `ProductOutcomeDto` (`product-outcome.dto.ts`). */
export interface ProductOutcome {
  id: string
  productId: string
  recordedBy: string | null
  recipeId: string | null
  kind: OutcomeKind
  discardReason: DiscardReason | null
  productName: string
  category: string
  categories: string[] | null
  location: LocationValue
  quantity: { amount: number; unit: string }
  price: number | null
  expiresAt: string | null
  occurredAt: string
}

export interface RecordedProductOutcome {
  /** `null` when the whole stock left the garde-manger. */
  product: Product | null
  outcome: ProductOutcome
}
