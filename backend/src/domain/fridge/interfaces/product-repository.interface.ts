import type { Product } from '../product.entity.js'
import type { ProductOutcome } from '../product-outcome.entity.js'
import type { LocationValue } from '../location.vo.js'

export interface ProductFilters {
  location?: LocationValue
  expiringWithinDays?: number
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>
  findByHousehold(householdId: string, filters?: ProductFilters): Promise<Product[]>
  findExpiringSoon(householdId: string, withinDays: number): Promise<Product[]>
  /** Calendar dates for the daily digest, inclusive of today and the chosen final day. */
  findExpiringForDigest(householdId: string, today: string, days: number): Promise<Product[]>
  findByReceiptId(receiptId: string): Promise<Product[]>
  save(product: Product): Promise<void>
  /** A data-entry correction: removes the product and records nothing (ADR-0012). */
  delete(id: string): Promise<void>
  /**
   * Writes the outcome and applies it to the stock in one transaction:
   * `remaining === null` deletes the product, otherwise `remaining` is saved.
   */
  recordOutcome(outcome: ProductOutcome, remaining: Product | null): Promise<void>
}
