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

/** Absolute assignments use the server version; DELETE always wins over a stale edit. */
export class MutationQueue {
  private entries: QueuedMutation[] = []
  private ready: Promise<void>
  private writes: Promise<unknown> = Promise.resolve()
  private replaying = false
  private sendingId: number | null = null
  private revision = 0
  private storageUnavailable = false
  private listeners = new Set<() => void>()

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): string => `${this.revision}:${JSON.stringify(this.scope())}`
  private notify() {
    this.revision++
    for (const listener of this.listeners) listener()
  }
  status() {
    const entries = this.entries.filter((entry) => sameScope(entry.scope, this.scope()))
    return { entries, syncing: this.sendingId !== null && entries.some((entry) => entry.id === this.sendingId),
      storageUnavailable: this.storageUnavailable }
  }

  /** Conflicts keep their explicit fresh-row recovery; retry only ordinary delivery failures. */
  async retry(id?: number): Promise<void> {
    if (this.replaying) return
    const scope = this.scope()
    if (!scope) return
    await this.edit((entries) => {
      const selected = entries.find((entry) => entry.id === id && sameScope(entry.scope, scope))
      if (selected && ['sync_conflict', 'product_not_found', 'shopping_item_not_found', 'unauthenticated'].includes(selected.error?.type ?? '')) return entries
      return entries.map((entry) => {
        if (!sameScope(entry.scope, scope) || ['sync_conflict', 'product_not_found', 'shopping_item_not_found', 'unauthenticated'].includes(entry.error?.type ?? '')) return entry
        const retry = id === undefined ? !entry.error : selected && entry.collection === selected.collection && entry.entityId === selected.entityId
        return retry ? { ...entry, error: undefined, retryAt: 0 } : entry
      })
    })
    await this.flush(true)
  }

  constructor(
    private storage: QueueStorage,
    private scope: () => SyncScope | null,
    private send: (entry: QueuedMutation) => Promise<Result<unknown, ApiError>>,
    private changed: (entry: QueuedMutation) => void,
    private failed: (entry: QueuedMutation) => void,
    private now: () => number = Date.now,
    private cancelled?: (entry: QueuedMutation, row: Product | ShoppingItem | null) => void,
  ) {
    this.ready = storage.read().then((entries) => { this.entries = entries; this.notify() }, (error) => {
      this.storageUnavailable = true
      this.notify()
      throw error
    })
    // Retain the rejection for callers, without an unhandled boot-time promise.
    void this.ready.catch(() => {})
  }

  private async edit(change: (entries: QueuedMutation[]) => QueuedMutation[], committed?: () => void): Promise<void> {
    const operation = this.writes.then(async () => {
      await this.ready
      const next = change(this.entries)
      if (next === this.entries) return
      await this.storage.write(next)
      this.entries = next
      try { committed?.() }
      finally { this.notify() }
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

  /** Recoverable local intent, scoped and retained across restarts. */
  async failures(): Promise<QueuedMutation[]> {
    await this.ready
    return this.entries.filter((entry) => entry.error && sameScope(entry.scope, this.scope()))
  }

  /** Explicit user recovery after reading the latest server row. */
  async reapplyConflicts(collection: QueuedMutation['collection'], base: Product | ShoppingItem): Promise<void> {
    const scope = this.scope()
    let nextBase = base
    await this.edit((entries) => entries.map((entry) => {
      if (!sameScope(entry.scope, scope) || entry.collection !== collection || entry.entityId !== base.id || entry.error?.type !== 'sync_conflict') return entry
      const next = { ...entry, base: nextBase, error: undefined, attempts: 0, retryAt: 0 }
      if (entry.patch) nextBase = { ...nextBase, ...entry.patch }
      return next
    }))
  }

  async discardFailure(id: number): Promise<void> {
    const scope = this.scope()
    await this.edit((entries) => entries.filter((entry) =>
      !(entry.id === id && entry.error && sameScope(entry.scope, scope)),
    ))
  }

  /** Remove local intent durably; an action already being sent cannot be recalled. */
  async cancel(id: number): Promise<Result<undefined, ApiError>> {
    const scope = this.scope()
    let entry: QueuedMutation | undefined
    let row: Product | ShoppingItem | null = null
    let refusal: ApiError | undefined
    let persisted = false
    try {
      await this.edit((entries) => {
        entry = entries.find((item) => item.id === id && sameScope(item.scope, scope))
        if (!entry || !sameScope(scope, this.scope())) {
          refusal = { type: 'action_unavailable', message: 'Cette action n’est plus disponible.' }
          return entries
        }
        if (this.sendingId === id) {
          refusal = { type: 'action_syncing', message: 'Cette action est déjà en cours de synchronisation.' }
          return entries
        }
        const removed = entry
        const fields = Object.keys(removed.patch ?? {}).filter((field) => field !== 'expectedUpdatedAt')
        let base = removed.base
        const next = entries.filter((item) => item !== removed).map((item) => {
          if (removed.error || item.id < id || !sameScope(item.scope, scope) || item.collection !== removed.collection ||
            item.entityId !== removed.entityId || item.base.updatedAt !== removed.base.updatedAt) return item
          // Later snapshots must not retain the assignment we just removed.
          const previous = base as unknown as Record<string, unknown>
          const corrected = { ...item.base, ...Object.fromEntries(fields.map((field) => [field, previous[field]])) }
          base = item.patch ? { ...corrected, ...item.patch } : corrected
          return { ...item, base: corrected }
        })
        row = removed.base
        for (const item of next) {
          if (item.error || !sameScope(item.scope, scope) || item.collection !== removed.collection || item.entityId !== removed.entityId) continue
          row = item.patch ? { ...(row ?? item.base), ...item.patch } : null
        }
        return next
      }, () => {
        persisted = true
        if (entry && !refusal && sameScope(scope, this.scope())) this.cancelled?.(entry, row)
      })
    } catch {
      return Result.err(persisted
        ? { type: 'cache_update_error', message: 'Action retirée, mais les données affichées doivent être rechargées.' }
        : { type: 'storage_error', message: 'Impossible de sauvegarder l’annulation sur cet appareil.' })
    }
    return refusal ? Result.err(refusal) : Result.ok(undefined)
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
      for (const snapshot of [...this.entries]) {
        await this.writes
        const entry = this.entries.find((item) => item.id === snapshot.id)
        if (!entry) continue
        if (!sameScope(scope, this.scope())) break
        if (!sameScope(entry.scope, scope)) continue
        const key = `${entry.collection}:${entry.entityId}`
        if (entry.error) {
          if (!['sync_conflict', 'product_not_found', 'shopping_item_not_found', 'unauthenticated'].includes(entry.error.type)) blocked.add(key)
          continue
        }
        if (blocked.has(key)) continue
        if (!force && entry.retryAt > this.now()) { blocked.add(key); continue }
        let result: Result<unknown, ApiError>
        this.sendingId = entry.id
        this.notify()
        try { result = await this.send(entry) }
        catch { result = Result.err({ type: 'network_error', message: 'Serveur indisponible.' }) }
        const alreadyDeleted = !result.ok && entry.patch === null &&
          result.error.type === (entry.collection === 'products' ? 'product_not_found' : 'shopping_item_not_found')
        if (result.ok || alreadyDeleted) {
          await this.edit((entries) => entries.filter((item) => item.id !== entry.id).map((item) => {
            if (!result.ok || !result.value || typeof result.value !== 'object' || !('updatedAt' in result.value)) return item
            // A matching replay might include unrelated remote edits after a lost response.
            // Rebase only when the entire editable state matches our intended result.
            const fields = entry.collection === 'products'
              ? ['name', 'quantity', 'location', 'category', 'expiresAt', 'openedAt', 'openfoodfactId', 'categories', 'price']
              : ['name', 'quantity', 'checked']
            const expected = { ...entry.base, ...entry.patch } as unknown as Record<string, unknown>
            const actual = result.value as Record<string, unknown>
            const unchanged = fields.every((field) => JSON.stringify(actual[field]) === JSON.stringify(expected[field]))
            return unchanged && item.base.updatedAt === entry.base.updatedAt && sameScope(item.scope, scope) && item.collection === entry.collection && item.entityId === entry.entityId && !item.error
              ? { ...item, base: { ...item.base, updatedAt: result.value.updatedAt as string } } : item
          }))
        } else if (['network_error', 'temporary_error'].includes(result.error.type)) {
          const error = result.error
          await this.edit((entries) => entries.map((item) => item.id === entry.id ? {
            ...item, attempts: item.attempts + 1,
            retryAt: this.now() + Math.min(300_000, 1_000 * 2 ** Math.min(item.attempts, 9)),
          } : item))
          blocked.add(key)
          // Transport outage affects the server, not just this entity.
          this.sendingId = null
          if (error.type === 'network_error') break
          continue
        } else {
          const error = result.error
          await this.edit((entries) => entries.map((item) =>
            sameScope(item.scope, scope) && item.collection === entry.collection && item.entityId === entry.entityId && item.id >= entry.id && !item.error
              ? { ...item, error } : item,
          ))
          blocked.add(key)
          this.failed({ ...entry, error })
        }
        // A response for an old session must not update the current account's cache.
        if (sameScope(scope, this.scope())) this.changed(entry)
        this.sendingId = null
      }
    } finally {
      this.sendingId = null
      this.replaying = false
      this.notify()
    }
  }
}
