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
  expectedUpdatedAt?: Date
  name?: string
  quantity?: { amount: number; unit: string }
  checked?: boolean
}

export type UpdateShoppingItemError = 'shopping_item_not_found' | 'sync_conflict' | ValidationError

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
    const item = await this.items.findById(input.itemId)
    if (!item || item.householdId !== input.householdId)
      return Result.err('shopping_item_not_found')

    const version = item.updatedAt
    if (input.expectedUpdatedAt && input.expectedUpdatedAt.getTime() !== version.getTime())
      return Result.err('sync_conflict')

    const patch: UpdateShoppingItemProps = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.quantity !== undefined) {
      const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
      if (!quantity.ok) return quantity
      patch.quantity = quantity.value
    }

    const now = new Date(Math.max(this.clock.now().getTime(), version.getTime() + 1))
    if (Object.keys(patch).length > 0) item.update(patch, now)
    if (input.checked !== undefined && input.checked !== item.checked) item.toggle(now)

    if (!(await this.items.saveIfUnchanged(item, version))) return Result.err('sync_conflict')
    return Result.ok(item)
  }
}
