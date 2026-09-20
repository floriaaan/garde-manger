import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mirrors Stripe's `cancel_at_period_end`: a cancelled subscription stays
 * `active` (and `expires_at` in the future) until the paid period ends, so the
 * app needs its own flag to say "cancelled, access until <date>".
 */
export default class extends BaseSchema {
  protected tableName = 'household_subscription'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('cancel_at_period_end').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('cancel_at_period_end')
    })
  }
}
