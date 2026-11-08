import type { ShoppingItem } from '../shopping-item.entity.js'

export interface ShoppingItemRepository {
  /** Production adapters serialize the read/create decision within a foyer. */
  withHouseholdLock?<T>(
    householdId: string,
    action: (items: ShoppingItemRepository) => Promise<T>,
  ): Promise<T>
  findById(id: string): Promise<ShoppingItem | null>
  findByHousehold(householdId: string): Promise<ShoppingItem[]>
  save(item: ShoppingItem): Promise<void>
  delete(id: string): Promise<void>
  /** Resets `ha_uid`/`ha_synced_at` to null for every item in the household —
   * used by `UnlinkHomeAssistant` (Task 12) so a stale uid never survives a
   * "Délier" and gets mis-adopted if the foyer reconnects later. */
  clearHomeAssistantSync(householdId: string): Promise<void>
}
