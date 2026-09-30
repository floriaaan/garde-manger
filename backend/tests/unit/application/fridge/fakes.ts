import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'
import type { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import { Product as ProductEntity } from '#domain/fridge/product.entity'

export class FakeProductRepository implements ProductRepository {
  readonly products = new Map<string, Product>()
  readonly outcomes: ProductOutcome[] = []

  async findById(id: string) {
    return this.products.get(id) ?? null
  }
  async findByHousehold(householdId: string) {
    return [...this.products.values()].filter((product) => product.householdId === householdId)
  }
  async findExpiringSoon() {
    return []
  }
  async findExpiringForDigest() {
    return []
  }
  async findByReceiptId() {
    return []
  }
  async save(product: Product) {
    this.products.set(product.id, product)
  }
  async delete(id: string) {
    this.products.delete(id)
  }
  async recordOutcome(outcome: ProductOutcome, remaining: Product | null) {
    if (remaining === null) this.products.delete(outcome.productId)
    else this.products.set(remaining.id, remaining)
    this.outcomes.push(outcome)
  }
}

export function buildProduct(
  overrides: Partial<{
    id: string
    householdId: string
    amount: number
    price: number | null
  }> = {},
): Product {
  const quantity = Quantity.create(overrides.amount ?? 6, 'unités')
  const location = Location.create('fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')
  return ProductEntity.create({
    id: overrides.id ?? 'p_1',
    householdId: overrides.householdId ?? 'h_1',
    name: 'Yaourts nature',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    price: overrides.price ?? 3,
    createdAt: new Date('2026-09-01T10:00:00Z'),
  })
}

export const FIXED_CLOCK = { now: () => new Date('2026-09-13T18:00:00.000Z') }
export const SEQUENTIAL_IDS = (prefix: string) => {
  let n = 0
  return { next: () => `${prefix}-${++n}` }
}
