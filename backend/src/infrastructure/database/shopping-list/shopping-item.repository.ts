import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ShoppingItemModel from './shopping-item.lucid.js'
import { toDomain } from './shopping-item.mapper.js'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export class LucidShoppingItemRepository implements ShoppingItemRepository {
  async findById(id: string): Promise<ShoppingItem | null> {
    const row = await ShoppingItemModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<ShoppingItem[]> {
    const rows = await ShoppingItemModel.query()
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
    )
  }

  async saveIfUnchanged(item: ShoppingItem, updatedAt: Date): Promise<boolean> {
    const rows = await db
      .from('shopping_item')
      .where('id', item.id)
      .where('household_id', item.householdId)
      .where('updated_at', updatedAt)
      .update({
        name: item.name,
        quantity: item.quantity.amount,
        unit: item.quantity.unit,
        checked: item.checked,
        updated_at: item.updatedAt,
      })
      .returning('id')
    return rows.length > 0
  }

  async delete(id: string): Promise<void> {
    await ShoppingItemModel.query().where('id', id).delete()
  }

  async clearHomeAssistantSync(householdId: string): Promise<void> {
    await ShoppingItemModel.query()
      .where('household_id', householdId)
      .update({ ha_uid: null, ha_synced_at: null })
  }
}
