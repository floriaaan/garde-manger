import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProductModel from './product.lucid.js'
import ProductOutcomeModel from './product_outcome.lucid.js'
import { toDomain } from './product.mapper.js'
import type {
  ProductRepository,
  ProductFilters,
} from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'
import type { ProductOutcome } from '#domain/fridge/product-outcome.entity'

function toRow(product: Product) {
  return {
    householdId: product.householdId,
    receiptId: product.receiptId,
    name: product.name,
    quantity: product.quantity.amount,
    initialQuantity: product.initialQuantity,
    unit: product.quantity.unit,
    location: product.location.value,
    expiresAt: product.expiresAt ? DateTime.fromJSDate(product.expiresAt) : null,
    openedAt: product.openedAt ? DateTime.fromJSDate(product.openedAt) : null,
    category: product.category,
    openfoodfactId: product.openfoodfactId,
    categories: product.categories,
    price: product.price,
    imageKey: product.imageKey,
  }
}

export class LucidProductRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const row = await ProductModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string, filters: ProductFilters = {}): Promise<Product[]> {
    const query = ProductModel.query().where('household_id', householdId)
    if (filters.location) query.where('location', filters.location)
    if (filters.expiringWithinDays !== undefined) {
      const now = new Date()
      const threshold = new Date(now.getTime() + filters.expiringWithinDays * 24 * 60 * 60 * 1000)
      query
        .whereNotNull('expires_at')
        .where('expires_at', '>=', now.toISOString())
        .where('expires_at', '<=', threshold.toISOString())
    }
    const rows = await query.orderBy('expires_at', 'asc')
    return rows.map(toDomain)
  }

  async findExpiringSoon(householdId: string, withinDays: number): Promise<Product[]> {
    return this.findByHousehold(householdId, { expiringWithinDays: withinDays })
  }

  async findExpiringForDigest(
    householdId: string,
    today: string,
    days: number,
  ): Promise<Product[]> {
    // Product dates are stored as UTC-midnight calendar dates by the form.
    // Compare whole dates so a product dated today is still eligible at 9 h.
    const through = new Date(`${today}T00:00:00.000Z`)
    through.setUTCDate(through.getUTCDate() + days + 1)
    const rows = await ProductModel.query()
      .where('household_id', householdId)
      .where('expires_at', '>=', `${today}T00:00:00.000Z`)
      .where('expires_at', '<', through.toISOString())
      .orderBy('expires_at', 'asc')
    return rows.map(toDomain)
  }

  async findByReceiptId(receiptId: string): Promise<Product[]> {
    const rows = await ProductModel.query().where('receipt_id', receiptId)
    return rows.map(toDomain)
  }

  async save(product: Product): Promise<void> {
    await ProductModel.updateOrCreate({ id: product.id }, toRow(product))
  }

  async delete(id: string): Promise<void> {
    await ProductModel.query().where('id', id).delete()
  }

  /**
   * Stock first, log second, one transaction: if the log row cannot be
   * written, the product comes back — a sale that vanished from the fridge
   * without a trace is exactly what this table exists to prevent.
   */
  async recordOutcome(outcome: ProductOutcome, remaining: Product | null): Promise<void> {
    await db.transaction(async (trx) => {
      if (remaining === null) {
        await ProductModel.query({ client: trx }).where('id', outcome.productId).delete()
      } else {
        await ProductModel.updateOrCreate({ id: remaining.id }, toRow(remaining), { client: trx })
      }

      await ProductOutcomeModel.create(
        {
          id: outcome.id,
          householdId: outcome.householdId,
          productId: outcome.productId,
          recordedBy: outcome.recordedBy,
          recipeId: outcome.recipeId,
          kind: outcome.kind.value,
          discardReason: outcome.discardReason?.value ?? null,
          productName: outcome.productName,
          category: outcome.category,
          categories: outcome.categories,
          location: outcome.location.value,
          amount: outcome.quantity.amount,
          unit: outcome.quantity.unit,
          price: outcome.price,
          expiresAt: outcome.expiresAt ? DateTime.fromJSDate(outcome.expiresAt) : null,
          occurredAt: DateTime.fromJSDate(outcome.occurredAt),
        },
        { client: trx },
      )
    })
  }
}
