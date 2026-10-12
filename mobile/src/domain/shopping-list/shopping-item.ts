/** Structurally identical to the backend's `ShoppingItemDto` (`shopping-item.dto.ts`) — no re-mapping on this side. */
export interface ShoppingItem {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  checked: boolean
  source: string
  createdAt: string
  updatedAt: string
}

/**
 * Mirrors `createShoppingItemValidator` field-for-field. `source` is
 * required there (no default — `ShoppingItemSource.create` rejects a
 * missing value same as an invalid one), so every caller must say which of
 * the three it is: `'manual'` from the shopping-list form, `'recipe'` from
 * a recipe's "Ajouter à la liste de courses", `'auto_expired'` reserved for
 * a producer this app doesn't have yet (see the backend value object's own
 * note). Omitting it here used to fail that validation on every request —
 * `FakeFridgeConnector.createShoppingItem` never enforced it, so no test
 * caught the mismatch until a real device did.
 */
export interface CreateShoppingItemInput {
  name: string
  quantity: { amount: number; unit: string }
  source: 'manual' | 'auto_expired' | 'recipe'
}

/** Mirrors `updateShoppingItemValidator` — any subset of fields, same shape `updateProduct`'s patch already uses. */
export interface UpdateShoppingItemInput {
  expectedUpdatedAt?: string
  name?: string
  quantity?: { amount: number; unit: string }
  checked?: boolean
}
