import { normalizeShoppingItemName } from '../shopping-list/shopping-item-merge.js'
import type { FridgeScanDraftItem } from './fridge-scan-draft.js'
import type { Product } from './product.js'

/** Normalized-name match against what's already in the fridge — a hint to review, not a hard block. */
export function isLikelyDuplicate(item: FridgeScanDraftItem, existingProducts: Product[]): boolean {
  const name = normalizeShoppingItemName(item.name)
  return existingProducts.some((product) => normalizeShoppingItemName(product.name) === name)
}
