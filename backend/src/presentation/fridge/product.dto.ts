import type { Product } from '#domain/fridge/product.entity'

export interface ProductDto {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  initialQuantity: number
  location: string
  expiresAt: string | null
  openedAt: string | null
  category: string
  categories: string[] | null
  openfoodfactId: string | null
  receiptId: string | null
  price: number | null
  imageKey: string | null
  createdAt: string
  updatedAt: string
}

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name,
    quantity: { amount: product.quantity.amount, unit: product.quantity.unit },
    initialQuantity: product.initialQuantity,
    location: product.location.value,
    expiresAt: product.expiresAt?.toISOString() ?? null,
    openedAt: product.openedAt?.toISOString() ?? null,
    category: product.category,
    categories: product.categories,
    openfoodfactId: product.openfoodfactId,
    receiptId: product.receiptId,
    price: product.price,
    imageKey: product.imageKey,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}
