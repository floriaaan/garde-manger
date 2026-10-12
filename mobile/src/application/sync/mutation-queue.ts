import type { Product, UpdateProductInput } from '../../domain/fridge/product.js'
import type { ShoppingItem, UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import { Result } from '../../domain/shared/result.js'

export type SyncScope = { server: string; userId: string; householdId: string }
export type QueuedMutation = {
  id: number
  scope: SyncScope
  collection: 'products' | 'shopping-items'
  entityId: string
  base: Product | ShoppingItem
  patch: UpdateProductInput | UpdateShoppingItemInput | null
  attempts: number
  retryAt: number
  error?: ApiError
}
export interface QueueStorage {
  read(): Promise<QueuedMutation[]>
  write(entries: QueuedMutation[]): Promise<void>
}

export function sameScope(a: SyncScope | null, b: SyncScope | null): boolean {
  return Boolean(a && b && a.server === b.server && a.userId === b.userId && a.householdId === b.householdId)
}

/** Only absolute PATCH assignments and DELETE are supported: replay cannot create duplicates. */
export class MutationQueue {
  private entries: QueuedMutation[] = []
  private ready: Promise<void>
  private writes: Promise<unknown> = Promise.resolve()
  private replaying = false

  constructor(
    private storage: QueueStorage,
    private scope: () => SyncScope | null,
    private send: (entry: QueuedMutation) => Promise<Result<unknown, ApiError>>,
    private changed: (entry: QueuedMutation) => void,
    private failed: (entry: QueuedMutation) => void,
    private now: () => number = Date.now,
  ) {
    this.ready = storage.read().then((entries) => { this.entries = entries })
    // Retain the rejection for callers, without an unhandled boot-time promise.
    void this.ready.catch(() => {})
  }

  private async edit(change: (entries: QueuedMutation[]) => QueuedMutation[]): Promise<void> {
    const operation = this.writes.then(async () => {
      await this.ready
      const next = change(this.entries)
      await this.storage.write(next)
      this.entries = next
    })
    this.writes = operation.catch(() => {})
    await operation
  }

  async enqueue(
    collection: QueuedMutation['collection'],
    base: Product | ShoppingItem,
    patch: QueuedMutation['patch'],
  ): Promise<Result<Product | ShoppingItem | undefined, ApiError>> {
    const scope = this.scope()
    if (!scope) return Result.err({ type: 'unauthenticated', message: 'Session ou foyer indisponible.' })
    let entry!: QueuedMutation
    try {
      await this.edit((entries) => {
        entry = {
          id: Math.max(this.now(), ...entries.map((item) => item.id + 1)),
          scope, collection, entityId: base.id, base, patch, attempts: 0, retryAt: 0,
        }
        return [...entries, entry]
      })
    } catch {
      return Result.err({ type: 'storage_error', message: 'Impossible de sauvegarder cette modification sur cet appareil.' })
    }
    if (!sameScope(scope, this.scope())) {
      return Result.err({ type: 'session_changed', message: 'Le compte ou le foyer a changé pendant la sauvegarde.' })
    }
    this.changed(entry)
    return Result.ok(patch ? { ...base, ...patch } : undefined)
  }

  /** Pending base rows also survive a failed read or restart; unrelated rows belong to #82. */
  async pending(): Promise<QueuedMutation[]> {
    await this.ready
    return this.entries.filter((entry) => !entry.error && sameScope(entry.scope, this.scope()))
  }

  async overlay<T extends Product | ShoppingItem>(collection: QueuedMutation['collection'], rows: T[]): Promise<T[]> {
    await this.ready
    const result = new Map(rows.map((row) => [row.id, row]))
    for (const entry of await this.pending()) {
      if (entry.collection !== collection) continue
      if (entry.patch === null) result.delete(entry.entityId)
      else result.set(entry.entityId, { ...(result.get(entry.entityId) ?? entry.base), ...entry.patch } as T)
    }
    return [...result.values()]
  }

  async flush(force = false): Promise<void> {
    if (this.replaying) return
    this.replaying = true
    try {
      await this.ready
      await this.writes
      const scope = this.scope()
      if (!scope) return
      const blocked = new Set<string>()
      for (const entry of [...this.entries]) {
        if (!sameScope(scope, this.scope())) break
        if (!sameScope(entry.scope, scope) || entry.error) continue
        const key = `${entry.collection}:${entry.entityId}`
        if (blocked.has(key)) continue
        if (!force && entry.retryAt > this.now()) { blocked.add(key); continue }
        let result: Result<unknown, ApiError>
        try { result = await this.send(entry) }
        catch { result = Result.err({ type: 'network_error', message: 'Serveur indisponible.' }) }
        const alreadyDeleted = !result.ok && entry.patch === null &&
          result.error.type === (entry.collection === 'products' ? 'product_not_found' : 'shopping_item_not_found')
        if (result.ok || alreadyDeleted) {
          await this.edit((entries) => entries.filter((item) => item.id !== entry.id))
        } else if (['network_error', 'temporary_error'].includes(result.error.type)) {
          const error = result.error
          await this.edit((entries) => entries.map((item) => item.id === entry.id ? {
            ...item, attempts: item.attempts + 1,
            retryAt: this.now() + Math.min(300_000, 1_000 * 2 ** Math.min(item.attempts, 9)),
          } : item))
          blocked.add(key)
          // Transport outage affects the server, not just this entity.
          if (error.type === 'network_error') break
          continue
        } else {
          const error = result.error
          await this.edit((entries) => entries.map((item) => item.id === entry.id ? { ...item, error } : item))
          this.failed({ ...entry, error })
        }
        // A response for an old session must not update the current account's cache.
        if (sameScope(scope, this.scope())) this.changed(entry)
      }
    } finally {
      this.replaying = false
    }
  }
}
