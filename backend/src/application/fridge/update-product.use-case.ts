import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { type Product, type UpdateProductProps } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface UpdateProductInput {
  householdId: string
  productId: string
  expectedUpdatedAt?: Date
  name?: string
  quantity?: { amount: number; unit: string }
  location?: string
  category?: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}

export type UpdateProductError = 'product_not_found' | 'sync_conflict' | ValidationError

export class UpdateProduct implements UseCase<
  UpdateProductInput,
  ResultType<Product, UpdateProductError>
> {
  constructor(
    private readonly products: ProductRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateProductInput): Promise<ResultType<Product, UpdateProductError>> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId)
      return Result.err('product_not_found')

    const version = product.updatedAt
    if (input.expectedUpdatedAt && input.expectedUpdatedAt.getTime() !== version.getTime())
      return Result.err('sync_conflict')

    const patch: UpdateProductProps = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.category !== undefined) patch.category = input.category
    if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt
    if (input.openedAt !== undefined) patch.openedAt = input.openedAt
    if (input.openfoodfactId !== undefined) patch.openfoodfactId = input.openfoodfactId
    if (input.categories !== undefined) patch.categories = input.categories
    if (input.price !== undefined) patch.price = input.price

    if (input.quantity !== undefined) {
      const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
      if (!quantity.ok) return quantity
      patch.quantity = quantity.value
    }

    if (input.location !== undefined) {
      const location = Location.create(input.location)
      if (!location.ok) return location
      patch.location = location.value
    }

    product.update(patch, new Date(Math.max(this.clock.now().getTime(), version.getTime() + 1)))
    if (!(await this.products.saveIfUnchanged(product, version)))
      return Result.err('sync_conflict')
    return Result.ok(product)
  }
}
