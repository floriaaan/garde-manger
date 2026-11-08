import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteShoppingItemInput {
  householdId: string
  itemId: string
}

export type DeleteShoppingItemError = 'shopping_item_not_found'

export class DeleteShoppingItem implements UseCase<
  DeleteShoppingItemInput,
  ResultType<void, DeleteShoppingItemError>
> {
  constructor(private readonly items: ShoppingItemRepository) {}

  async execute(
    input: DeleteShoppingItemInput,
  ): Promise<ResultType<void, DeleteShoppingItemError>> {
    if (this.items.withHouseholdLock) {
      return this.items.withHouseholdLock(input.householdId, (items) =>
        new DeleteShoppingItem(items).executeUnlocked(input),
      )
    }
    return this.executeUnlocked(input)
  }

  private async executeUnlocked(
    input: DeleteShoppingItemInput,
  ): Promise<ResultType<void, DeleteShoppingItemError>> {
    const item = await this.items.findById(input.itemId)
    if (!item || item.householdId !== input.householdId)
      return Result.err('shopping_item_not_found')
    await this.items.delete(item.id)
    return Result.ok(undefined)
  }
}
