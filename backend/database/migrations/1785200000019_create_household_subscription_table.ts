import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per household with any entitlement history — the household is
 * "subscribed" iff `expires_at > now()`. No `status` column: every
 * RevenueCat webhook event (renewal, cancellation, billing issue,
 * expiration…) reduces to "here is the new `expires_at`", so the row never
 * needs a second source of truth to reconcile against it.
 */
export default class extends BaseSchema {
  protected tableName = 'household_subscription'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('household_id').primary().references('id').inTable('household').onDelete('CASCADE')
      table.text('payer_user_id').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.text('store').notNullable().checkIn(['app_store', 'play_store'])
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
