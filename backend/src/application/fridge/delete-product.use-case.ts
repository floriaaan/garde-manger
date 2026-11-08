import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteProductInput {
  householdId: string
  productId: string
}

export type DeleteProductError = 'product_not_found'

/**
 * A data-entry correction — a duplicate scan, a receipt line that was not
 * food. Deliberately records no outcome: counting mistakes as waste would make
 * every statistic wrong. A product that was eaten or thrown away goes through
 * `RecordProductOutcome` instead (ADR-0012).
 */
export class DeleteProduct implements UseCase<
  DeleteProductInput,
  ResultType<void, DeleteProductError>
> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: DeleteProductInput): Promise<ResultType<void, DeleteProductError>> {
    if (this.products.withHouseholdLock) {
      return this.products.withHouseholdLock(input.householdId, (products) =>
        new DeleteProduct(products).executeUnlocked(input),
      )
    }
    return this.executeUnlocked(input)
  }

  private async executeUnlocked(
    input: DeleteProductInput,
  ): Promise<ResultType<void, DeleteProductError>> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId)
      return Result.err('product_not_found')
    await this.products.delete(product.id)
    return Result.ok(undefined)
  }
}
