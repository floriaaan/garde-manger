import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import {
  mergeQuantities,
  normalizeShoppingItemName,
} from '#domain/shopping-list/shopping-item-merge'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface CreateShoppingItemInput {
  householdId: string
  name: string
  quantity: { amount: number; unit: string }
  source: string
  /** Inventory restocking requires an explicit decision instead of summing. */
  onDuplicate?: 'reject' | 'keep' | 'replace'
  existingItemId?: string
}

export interface CreateShoppingItemOutput {
  item: ShoppingItem
  /** `false` when this add merged into an existing (unchecked, same-name)
   * line instead of making a new one — the controller uses this to tell
   * Home Assistant to update that line rather than add a second one. */
  created: boolean
}

type CreateShoppingItemError = ValidationError | 'shopping_item_exists' | 'shopping_item_changed'

export class CreateShoppingItem implements UseCase<
  CreateShoppingItemInput,
  ResultType<CreateShoppingItemOutput, CreateShoppingItemError>
> {
  constructor(
    private readonly items: ShoppingItemRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: CreateShoppingItemInput,
  ): Promise<ResultType<CreateShoppingItemOutput, CreateShoppingItemError>> {
    if (this.items.withHouseholdLock) {
      return this.items.withHouseholdLock(input.householdId, (items) =>
        new CreateShoppingItem(items, this.idGenerator, this.clock).executeUnlocked(input),
      )
    }
    return this.executeUnlocked(input)
  }

  private async executeUnlocked(
    input: CreateShoppingItemInput,
  ): Promise<ResultType<CreateShoppingItemOutput, CreateShoppingItemError>> {
    const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
    if (!quantity.ok) return quantity

    const source = ShoppingItemSource.create(input.source)
    if (!source.ok) return source

    // "On ne devrait pas pouvoir ajouter deux fois les mêmes produits" —
    // a checked item is a closed, already-bought instance (see
    // `shopping-item.entity.ts`'s own `toggle`), so a fresh add for the
    // same name is a new need, not a duplicate of that one.
    const existing = await this.items.findByHousehold(input.householdId)
    const targetName = normalizeShoppingItemName(input.name)
    const target = existing.find(
      (candidate) => !candidate.checked && normalizeShoppingItemName(candidate.name) === targetName,
    )

    if (input.existingItemId && target?.id !== input.existingItemId) {
      return Result.err('shopping_item_changed')
    }
    if (target && input.onDuplicate) {
      if (input.onDuplicate === 'reject' || !input.existingItemId) {
        return Result.err('shopping_item_exists')
      }
      if (input.onDuplicate === 'replace') {
        target.update({ quantity: quantity.value }, this.clock.now())
        await this.items.save(target)
      }
      return Result.ok({ item: target, created: false })
    }
    if (target) {
      const merged = mergeQuantities(target.quantity, quantity.value)
      if (merged) {
        target.update({ quantity: merged }, this.clock.now())
        await this.items.save(target)
        return Result.ok({ item: target, created: false })
      }
      // Units don't merge (see `mergeQuantities`) — falls through to a
      // separate line, same as no name match at all.
    }

    const item = ShoppingItem.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      name: input.name,
      quantity: quantity.value,
      source: source.value,
      createdAt: this.clock.now(),
    })

    await this.items.save(item)
    return Result.ok({ item, created: true })
  }
}
