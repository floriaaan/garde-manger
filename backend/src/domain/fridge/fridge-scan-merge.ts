import { normalizeShoppingItemName } from '../shopping-list/shopping-item-merge.js'
import type { FridgeScanDraftItem } from './fridge-scan-draft.js'

/**
 * Same-name-and-location items across several photos of the same fridge are
 * almost always the same physical thing shot twice, not two different
 * batches — so merging keeps the higher quantity rather than summing them.
 * ponytail: naive max-wins heuristic, no unit conversion; revisit if scans
 * start mixing units for the same item.
 */
export function mergeScanItems(items: FridgeScanDraftItem[]): FridgeScanDraftItem[] {
  const merged = new Map<string, FridgeScanDraftItem>()
  for (const item of items) {
    const key = `${normalizeShoppingItemName(item.name)}|${item.location}`
    const existing = merged.get(key)
    if (!existing || item.quantity > existing.quantity) merged.set(key, item)
  }
  return [...merged.values()]
}
