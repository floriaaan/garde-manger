import { test } from '@japa/runner'
import { mergeScanItems } from '#domain/fridge/fridge-scan-merge'
import type { FridgeScanDraftItem } from '#domain/fridge/fridge-scan-draft'

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

test.group('mergeScanItems', () => {
  test('same name+location across photos keeps the higher quantity, not the sum', ({ assert }) => {
    const result = mergeScanItems([
      item({ quantity: 2 }),
      item({ quantity: 5 }),
      item({ quantity: 3 }),
    ])
    assert.deepEqual(result, [item({ quantity: 5 })])
  })

  test('same name, different location stays two items', ({ assert }) => {
    assert.lengthOf(mergeScanItems([item(), item({ location: 'freezer' })]), 2)
  })

  test('accent and case differences still count as the same item', ({ assert }) => {
    const result = mergeScanItems([
      item({ name: 'Épinards', quantity: 1 }),
      item({ name: 'epinards', quantity: 4 }),
    ])
    assert.deepEqual(result, [item({ name: 'epinards', quantity: 4 })])
  })
})
