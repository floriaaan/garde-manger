import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import type { Household } from '#domain/identity/household.aggregate'
import type { TodoEntity } from '#domain/home-assistant/todo-entity'
import type { TodoItem } from '#domain/home-assistant/todo-item'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Result } from '#domain/shared/result'

export class FakeHomeAssistantLinkRepository implements HomeAssistantLinkRepository {
  private byHousehold = new Map<string, HomeAssistantLink>()

  async find(householdId: string) {
    return this.byHousehold.get(householdId) ?? null
  }
  async save(link: HomeAssistantLink) {
    this.byHousehold.set(link.householdId, link)
  }
  async delete(householdId: string) {
    this.byHousehold.delete(householdId)
  }
}

export class FakeHouseholdRepository implements HouseholdRepository {
  constructor(private readonly households: Household[]) {}
  async findById(id: string) {
    return this.households.find((h) => h.id === id) ?? null
  }
  async findByUserId(userId: string) {
    return this.households.find((h) => h.members.some((m) => m.userId === userId)) ?? null
  }
  async findByInviteCode() {
    return null
  }
  async save() {}
  async delete() {}
}

export class FakeHostPolicy implements HostPolicy {
  constructor(private readonly allowed = true) {}
  isAllowed() {
    return this.allowed
  }
}

export class FakeHomeAssistantClient implements HomeAssistantClient {
  constructor(
    private readonly options: {
      pingError?: HomeAssistantError
      entities?: TodoEntity[]
      items?: TodoItem[]
    } = {},
  ) {}
  async ping(): ReturnType<HomeAssistantClient['ping']> {
    return this.options.pingError ? Result.err(this.options.pingError) : Result.ok(undefined)
  }
  async listTodoEntities() {
    return Result.ok(this.options.entities ?? [])
  }
  async listItems() {
    return Result.ok(this.options.items ?? [])
  }
  async addItem() {
    return Result.ok(undefined)
  }
  async updateItem() {
    return Result.ok(undefined)
  }
  async removeItem() {
    return Result.ok(undefined)
  }
}

export class FakeShoppingItemRepository implements ShoppingItemRepository {
  private items = new Map<string, ShoppingItem>()
  async findById(id: string) {
    const entity = this.items.get(id)
    return entity ? ShoppingItem.reconstruct(id, {
      householdId: entity.householdId,
      name: entity.name,
      quantity: entity.quantity,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      checked: entity.checked,
      source: entity.source,
      haUid: entity.haUid,
      haSyncedAt: entity.haSyncedAt,
    }) : null
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

export const FIXED_CLOCK = { now: () => new Date('2026-09-07T12:00:00.000Z') }
export const SEQUENTIAL_IDS = (prefix: string) => {
  let n = 0
  return { next: () => `${prefix}-${++n}` }
}

export class RecordingHomeAssistantClient implements HomeAssistantClient {
  calls: Array<{ method: string; args: unknown[] }> = []
  constructor(private readonly items: TodoItem[] = []) {}

  async ping() {
    return Result.ok(undefined)
  }
  async listTodoEntities() {
    return Result.ok([])
  }
  async listItems() {
    this.calls.push({ method: 'listItems', args: [] })
    return Result.ok(this.items)
  }
  async addItem(...args: unknown[]) {
    this.calls.push({ method: 'addItem', args })
    return Result.ok(undefined)
  }
  async updateItem(...args: unknown[]) {
    this.calls.push({ method: 'updateItem', args })
    return Result.ok(undefined)
  }
  async removeItem(...args: unknown[]) {
    this.calls.push({ method: 'removeItem', args })
    return Result.ok(undefined)
  }
}

export class FailingListItemsClient implements HomeAssistantClient {
  async ping() {
    return Result.ok(undefined)
  }
  async listTodoEntities() {
    return Result.ok([])
  }
  async listItems() {
    return Result.err('unreachable' as const)
  }
  async addItem() {
    return Result.ok(undefined)
  }
  async updateItem() {
    return Result.ok(undefined)
  }
  async removeItem() {
    return Result.ok(undefined)
  }
}

/** Same shape as `FailingListItemsClient`, but `listItems` succeeds (seeded
 * with `items`) and only `updateItem` fails — exercises the mid-pass abort
 * (`push()` throws inside the `try` block, not the pre-pass `listItems`
 * guard). */
export class FailingUpdateItemClient implements HomeAssistantClient {
  constructor(private readonly items: TodoItem[] = []) {}
  async ping() {
    return Result.ok(undefined)
  }
  async listTodoEntities() {
    return Result.ok([])
  }
  async listItems() {
    return Result.ok(this.items)
  }
  async addItem() {
    return Result.ok(undefined)
  }
  async updateItem() {
    return Result.err('unreachable' as const)
  }
  async removeItem() {
    return Result.ok(undefined)
  }
}
