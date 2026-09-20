import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Store billing (RevenueCat) gives way to Stripe (docs/adr/0015): the `store`
 * column goes, the Stripe ids come in. Nullable — a row written before this
 * migration keeps its `expires_at` until it lapses, it just has no Stripe
 * customer to open a portal for.
 */
export default class extends BaseSchema {
  protected tableName = 'household_subscription'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('store')
      table.text('stripe_customer_id').nullable()
      table.text('stripe_subscription_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('stripe_customer_id')
      table.dropColumn('stripe_subscription_id')
      table.text('store').notNullable().defaultTo('app_store').checkIn(['app_store', 'play_store'])
    })
  }
}
