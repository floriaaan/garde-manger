import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import type ProductModel from './product.lucid.js'
import type ProductOutcomeModel from './product_outcome.lucid.js'
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
import { DiscardReason } from '#domain/fridge/discard-reason.vo'

export function toOutcomeDomain(row: ProductOutcomeModel): ProductOutcome {
  const quantity = Quantity.create(row.amount, row.unit)
  const location = Location.create(row.location)
  const kind = OutcomeKind.create(row.kind)
  const reason = row.discardReason === null ? null : DiscardReason.create(row.discardReason)
  if (!quantity.ok || !location.ok || !kind.ok || (reason !== null && !reason.ok)) {
    throw new Error(`Corrupted product outcome row ${row.id}`)
  }
  return ProductOutcome.reconstruct(row.id, {
    householdId: row.householdId,
    productId: row.productId,
    recordedBy: row.recordedBy,
    recipeId: row.recipeId,
    kind: kind.value,
    discardReason: reason?.value ?? null,
    productName: row.productName,
    category: row.category,
    categories: row.categories,
    location: location.value,
    quantity: quantity.value,
    price: row.price === null ? null : Number(row.price),
    expiresAt: row.expiresAt?.toJSDate() ?? null,
    occurredAt: row.occurredAt.toJSDate(),
  })
}

export function toDomain(row: ProductModel): Product {
  const quantity = Quantity.create(row.quantity, row.unit)
  if (!quantity.ok) throw new Error(`Corrupted product row ${row.id}: ${quantity.error.message}`)

  const location = Location.create(row.location)
  if (!location.ok) throw new Error(`Corrupted product row ${row.id}: ${location.error.message}`)

  return Product.reconstruct(row.id, {
    householdId: row.householdId,
    receiptId: row.receiptId,
    name: row.name,
    quantity: quantity.value,
    initialQuantity: row.initialQuantity,
    location: location.value,
    expiresAt: row.expiresAt?.toJSDate() ?? null,
    openedAt: row.openedAt?.toJSDate() ?? null,
    category: row.category,
    openfoodfactId: row.openfoodfactId,
    categories: row.categories,
    price: row.price === null ? null : Number(row.price),
    imageKey: row.imageKey,
    createdAt: row.createdAt.toJSDate(),
    updatedAt: row.updatedAt.toJSDate(),
  })
}
