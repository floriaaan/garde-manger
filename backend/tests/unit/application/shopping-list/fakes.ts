import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export class FakeShoppingItemRepository implements ShoppingItemRepository {
  private items = new Map<string, ShoppingItem>()

  async findById(id: string) {
    const entity = this.items.get(id)
    return entity
      ? ShoppingItem.reconstruct(id, {
          householdId: entity.householdId,
          name: entity.name,
          quantity: entity.quantity,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          checked: entity.checked,
          source: entity.source,
          haUid: entity.haUid,
          haSyncedAt: entity.haSyncedAt,
        })
      : null
  }
  async findByHousehold(householdId: string) {
    return [...this.items.values()].filter((item) => item.householdId === householdId)
  }
  async save(item: ShoppingItem) {
    this.items.set(item.id, item)
  }
  async saveIfUnchanged(entity: ShoppingItem, updatedAt: Date) {
    if (this.items.get(entity.id)?.updatedAt.getTime() !== updatedAt.getTime()) return false
    await this.save(entity)
    return true
  }
  async delete(id: string) {
    this.items.delete(id)
  }
  async clearHomeAssistantSync(householdId: string) {
    for (const item of this.items.values()) {
      if (item.householdId === householdId) item.markSynced(null, new Date())
    }
  }
}

export const FIXED_CLOCK = { now: () => new Date('2026-09-09T12:00:00.000Z') }
export const SEQUENTIAL_IDS = (prefix: string) => {
  let n = 0
  return { next: () => `${prefix}-${++n}` }
}
