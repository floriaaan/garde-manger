import { isLikelyDuplicate } from './fridge-scan-merge.js'
import type { FridgeScanDraftItem } from './fridge-scan-draft.js'
import type { Product } from './product.js'

function item(overrides: Partial<FridgeScanDraftItem> = {}): FridgeScanDraftItem {
  return {
    name: 'Yaourts',
    quantity: 2,
    unit: 'pièce',
    category: null,
    location: 'fridge',
    expiresInDays: null,
    ...overrides,
  }
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Yaourts',
    quantity: { amount: 2, unit: 'pièce' },
    location: 'fridge',
    expiresAt: null,
    openedAt: null,
    category: 'Laitier',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: null,
    imageKey: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('isLikelyDuplicate', () => {
  test('normalized name matches an existing product', () => {
    expect(isLikelyDuplicate(item({ name: '  Yaourts  ' }), [product()])).toBe(true)
  })

  test('no match: not flagged', () => {
    expect(isLikelyDuplicate(item({ name: 'Compote' }), [product()])).toBe(false)
  })
})
