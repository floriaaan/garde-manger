import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'
import {
  type ShoppingItem,
  type UpdateShoppingItemProps,
} from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface UpdateShoppingItemInput {
  householdId: string
  itemId: string
  name?: string
  quantity?: { amount: number; unit: string }
  checked?: boolean
}

export type UpdateShoppingItemError = 'shopping_item_not_found' | ValidationError

export class UpdateShoppingItem implements UseCase<
  UpdateShoppingItemInput,
  ResultType<ShoppingItem, UpdateShoppingItemError>
> {
  constructor(
    private readonly items: ShoppingItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: UpdateShoppingItemInput,
  ): Promise<ResultType<ShoppingItem, UpdateShoppingItemError>> {
    if (this.items.withHouseholdLock) {
      return this.items.withHouseholdLock(input.householdId, (items) =>
        new UpdateShoppingItem(items, this.clock).executeUnlocked(input),
      )
    }
    return this.executeUnlocked(input)
  }

  private async executeUnlocked(
    input: UpdateShoppingItemInput,
  ): Promise<ResultType<ShoppingItem, UpdateShoppingItemError>> {
    const item = await this.items.findById(input.itemId)
    if (!item || item.householdId !== input.householdId)
      return Result.err('shopping_item_not_found')

    const patch: UpdateShoppingItemProps = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.quantity !== undefined) {
      const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
      if (!quantity.ok) return quantity
      patch.quantity = quantity.value
    }

    const now = this.clock.now()
    if (Object.keys(patch).length > 0) item.update(patch, now)
    if (input.checked !== undefined && input.checked !== item.checked) item.toggle(now)

    await this.items.save(item)
    return Result.ok(item)
  }
}
