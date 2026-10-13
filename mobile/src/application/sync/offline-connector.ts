import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Product } from '../../domain/fridge/product.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'
import type { Session } from '../../domain/identity/session.js'
import type { Household } from '../../domain/identity/household.js'
import { Result } from '../../domain/shared/result.js'
import { queryClient } from '../shared/query-client.js'
import { getServerUrl } from '../shared/server-config.js'
import { showToast } from '../shared/toast.js'
import { hasHouseholdMembership, isValidHousehold, isValidSession } from '../shared/offline-cache/verifications.js'
import { MutationQueue, sameScope, type QueueStorage, type QueuedMutation } from './mutation-queue.js'

type ProductFilters = Parameters<FridgeConnector['getProducts']>[0]

function matchesProduct(row: Product, params?: ProductFilters): boolean {
  return (!params?.location || row.location === params.location) &&
    (!params?.expiringWithinDays || (row.expiresAt !== null &&
      new Date(row.expiresAt).getTime() <= Date.now() + params.expiringWithinDays * 86_400_000))
}

export function withOfflineMutations(connector: FridgeConnector, storage: QueueStorage) {
  const updateProduct = connector.updateProduct.bind(connector)
  const deleteProduct = connector.deleteProduct.bind(connector)
  const updateItem = connector.updateShoppingItem.bind(connector)
  const deleteItem = connector.deleteShoppingItem.bind(connector)
  const getProducts = connector.getProducts.bind(connector)
  const getProduct = connector.getProduct.bind(connector)
  const getItems = connector.getShoppingItems.bind(connector)
  const cacheProduct = (id: string, product: Product | null) => {
    queryClient.setQueryData(['product', id], product)
    for (const [key, rows] of queryClient.getQueriesData<Product[]>({ queryKey: ['products'] })) {
      if (!rows) continue
      if (!product || !matchesProduct(product, key[1] as ProductFilters)) {
        queryClient.setQueryData(key, rows.filter((row) => row.id !== id))
        continue
      }
      const next = rows.map((row) => row.id === id ? product : row)
      if (!rows.some((row) => row.id === id)) next.push(product)
      queryClient.setQueryData(key, next)
    }
  }
  const scope = () => {
    const session = queryClient.getQueryData<Session>(['session'])
    const household = queryClient.getQueryData<Household>(['household'])
    return isValidSession(session) && isValidHousehold(household) && hasHouseholdMembership(session, household)
      ? { server: getServerUrl(), userId: session.user.id, householdId: household.id }
      : null
  }
  const refresh = (entry: QueuedMutation) => {
    if (!sameScope(entry.scope, scope())) return
    void queryClient.invalidateQueries({ queryKey: [entry.collection] })
    if (entry.collection === 'products') {
      void queryClient.invalidateQueries({ queryKey: ['product', entry.entityId] })
    }
  }
  const queue = new MutationQueue(storage, scope, async (entry) => {
    if (entry.patch === null) {
      return entry.collection === 'products' ? deleteProduct(entry.entityId) : deleteItem(entry.entityId)
    }
    // Read through the original connector, never through the optimistic overlay.
    const current = entry.collection === 'products'
      ? await getProduct(entry.entityId)
      : (await getItems()).find((item) => item.id === entry.entityId) ?? null
    if (!sameScope(entry.scope, scope())) return Result.err({ type: 'session_changed', message: 'Le compte ou le foyer a changé.' })
    if (!current) return Result.err({
      type: entry.collection === 'products' ? 'product_not_found' : 'shopping_item_not_found',
      message: 'Cet élément a été supprimé sur un autre appareil.',
    })
    // Lost acknowledgement: the requested absolute assignments already exist.
    const matches = Object.entries(entry.patch).filter(([key]) => key !== 'expectedUpdatedAt')
      .every(([key, value]) => JSON.stringify(current[key as keyof typeof current]) === JSON.stringify(value))
    if (matches) return Result.ok(current)
    if (current.updatedAt !== entry.base.updatedAt) {
      if (entry.collection === 'products') cacheProduct(entry.entityId, current as Product)
      else queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (rows) =>
        rows ? [...rows.filter((row) => row.id !== entry.entityId), current as ShoppingItem] : [current as ShoppingItem],
      )
      return Result.err({ type: 'sync_conflict', message: 'Cet élément a changé sur un autre appareil. Rechargez-le avant de réappliquer votre modification.' })
    }
    const patch = { ...entry.patch, expectedUpdatedAt: current.updatedAt }
    return entry.collection === 'products' ? updateProduct(entry.entityId, patch) : updateItem(entry.entityId, patch)
  }, refresh, (entry) => {
    if (entry.error?.type === 'unauthenticated') {
      showToast('Votre session a été révoquée. Reconnectez-vous avant de modifier vos données.')
      return
    }
    if (!sameScope(entry.scope, scope())) return
    const deleted = ['product_not_found', 'shopping_item_not_found'].includes(entry.error?.type ?? '')
    if (deleted) {
      if (entry.collection === 'products') cacheProduct(entry.entityId, null)
      else queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (rows) => rows?.filter((row) => row.id !== entry.entityId))
    } else if (entry.error?.type !== 'sync_conflict') {
      if (entry.collection === 'products') cacheProduct(entry.entityId, entry.base as Product)
      else queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (rows) =>
        rows ? [...rows.filter((row) => row.id !== entry.entityId), entry.base as ShoppingItem] : rows,
      )
    }
    showToast(`Synchronisation impossible pour « ${entry.base.name} » : ${entry.error?.message}`, 'error',
      entry.error?.type === 'sync_conflict' ? { label: 'Réappliquer', onPress: () => { void reapply(entry) } } : undefined,
    )
  }, undefined, (entry, row) => {
    if (!sameScope(entry.scope, scope())) return
    // Failed intent is not overlaid; preserve the authoritative row already refreshed on refusal.
    const current = entry.collection === 'products' ? findProduct(entry.entityId) : findItem(entry.entityId)
    if (!entry.error && (!current || current.updatedAt === entry.base.updatedAt)) {
      if (entry.collection === 'products') cacheProduct(entry.entityId, row as Product | null)
      else queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (rows) => {
        const next = (rows ?? []).filter((item) => item.id !== entry.entityId)
        return row ? [...next, row as ShoppingItem] : next
      })
    }
    refresh(entry)
  }, reapply)

  async function reapply(entry: QueuedMutation): Promise<void> {
    try {
      if (!sameScope(entry.scope, scope())) return
      const current = entry.collection === 'products'
        ? await getProduct(entry.entityId)
        : (await getItems()).find((item) => item.id === entry.entityId) ?? null
      if (!sameScope(entry.scope, scope())) return
      if (!current) {
        showToast('Cet élément a été supprimé. Votre modification reste conservée sur cet appareil.')
        return
      }
      await queue.reapplyConflicts(entry.collection, current)
      await restorePending()
      await queue.flush(true)
    } catch {
      showToast('Impossible de réappliquer pour le moment. Votre modification reste conservée sur cet appareil.')
    }
  }

  function findProduct(id: string): Product | undefined {
    return queryClient.getQueryData<Product>(['product', id]) ??
      queryClient.getQueriesData<Product[]>({ queryKey: ['products'] }).flatMap(([, rows]) => rows ?? []).find((row) => row.id === id)
  }
  function findItem(id: string): ShoppingItem | undefined {
    return queryClient.getQueryData<ShoppingItem[]>(['shopping-items'])?.find((row) => row.id === id)
  }
  const missing = () => Result.err({ type: 'local_data_missing', message: 'Ouvrez cet élément avant de le modifier hors ligne.' })

  connector.updateProduct = async (id, patch) => {
    const base = findProduct(id)
    if (!base) return missing()
    const result = await queue.enqueue('products', base, patch)
    if (!result.ok) return result
    const product = { ...base, ...patch }
    cacheProduct(id, product)
    return Result.ok(product)
  }
  connector.deleteProduct = async (id) => {
    const base = findProduct(id)
    if (!base) return missing()
    const result = await queue.enqueue('products', base, null)
    if (!result.ok) return result
    cacheProduct(id, null)
    return Result.ok(undefined)
  }
  connector.updateShoppingItem = async (id, patch) => {
    const base = findItem(id)
    if (!base) return missing()
    const result = await queue.enqueue('shopping-items', base, patch)
    if (!result.ok) return result
    const item = { ...base, ...patch }
    queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (rows) => rows?.map((row) => row.id === id ? item : row))
    return Result.ok(item)
  }
  connector.deleteShoppingItem = async (id) => {
    const base = findItem(id)
    if (!base) return missing()
    const result = await queue.enqueue('shopping-items', base, null)
    if (!result.ok) return result
    queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (rows) => rows?.filter((row) => row.id !== id))
    return Result.ok(undefined)
  }
  connector.getShoppingItems = async () => {
    const before = scope()
    const rows = await getItems()
    return sameScope(before, scope()) ? queue.overlay('shopping-items', rows) : []
  }
  connector.getProducts = async (params) => {
    const before = scope()
    const fetched = await getProducts(params)
    if (!sameScope(before, scope())) return []
    const rows = await queue.overlay('products', fetched)
    return rows.filter((row) => matchesProduct(row, params))
  }
  connector.getProduct = async (id) => {
    const before = scope()
    const row = await getProduct(id)
    if (!sameScope(before, scope())) return null
    return (await queue.overlay('products', row ? [row] : [])).find((product) => product.id === id) ?? null
  }
  const restorePending = async () => {
    const before = scope()
    for (const entry of await queue.failures()) {
      if (!sameScope(before, scope())) return
      if (['product_not_found', 'shopping_item_not_found'].includes(entry.error?.type ?? '')) {
        if (entry.collection === 'products') cacheProduct(entry.entityId, null)
        else queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (rows) => rows?.filter((row) => row.id !== entry.entityId))
      }
      refresh(entry)
    }
    const pending = await queue.pending()
    if (!sameScope(before, scope())) return
    for (const collection of ['products', 'shopping-items'] as const) {
      if (!pending.some((entry) => entry.collection === collection)) continue
      const key = collection === 'products' ? ['products', {}] : [collection]
      const rows = queryClient.getQueryData<(Product | ShoppingItem)[]>(key) ?? []
      const restored = await queue.overlay(collection, rows)
      if (!sameScope(before, scope())) return
      // Product list queries include a filter object; only seed the unfiltered list.
      queryClient.setQueryData(key, restored)
      if (collection === 'products') {
        for (const entry of pending.filter((entry) => entry.collection === collection)) {
          const product = restored.find((row) => row.id === entry.entityId) as Product | undefined
          cacheProduct(entry.entityId, product ?? null)
        }
      }
    }
  }
  return { connector, queue, restorePending }
}
