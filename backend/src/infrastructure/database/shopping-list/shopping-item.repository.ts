import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import ShoppingItemModel from './shopping-item.lucid.js'
import { toDomain } from './shopping-item.mapper.js'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export class LucidShoppingItemRepository implements ShoppingItemRepository {
  constructor(private readonly client?: TransactionClientContract) {}

  async withHouseholdLock<T>(
    householdId: string,
    action: (items: ShoppingItemRepository) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (trx) => {
      // Lock the foyer even when no shopping row exists yet.
      await trx.from('household').where('id', householdId).forUpdate().first()
      return action(new LucidShoppingItemRepository(trx))
    })
  }

  async findById(id: string): Promise<ShoppingItem | null> {
    const row = await ShoppingItemModel.query({ client: this.client }).where('id', id).first()
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<ShoppingItem[]> {
    const rows = await ShoppingItemModel.query({ client: this.client })
      .where('household_id', householdId)
      .orderBy('created_at', 'asc')
    return rows.map(toDomain)
  }

  async save(item: ShoppingItem): Promise<void> {
    await ShoppingItemModel.updateOrCreate(
      { id: item.id },
      {
        householdId: item.householdId,
        name: item.name,
        quantity: item.quantity.amount,
        unit: item.quantity.unit,
        checked: item.checked,
        source: item.source.value,
        haUid: item.haUid,
        haSyncedAt: item.haSyncedAt ? DateTime.fromJSDate(item.haSyncedAt) : null,
      },
      { client: this.client },
    )
  }

  async delete(id: string): Promise<void> {
    await ShoppingItemModel.query({ client: this.client }).where('id', id).delete()
  }

  async clearHomeAssistantSync(householdId: string): Promise<void> {
    await ShoppingItemModel.query()
      .where('household_id', householdId)
      .update({ ha_uid: null, ha_synced_at: null })
  }
}
