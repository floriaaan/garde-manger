import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One counter per household per calendar month (`period` = `YYYY-MM`, UTC).
 * `record()` upserts with `count = count + 1`, so the row only exists once
 * the foyer has made at least one successful AI call that month.
 */
export default class extends BaseSchema {
  protected tableName = 'ai_usage'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('period').notNullable()
      table.integer('count').notNullable().defaultTo(0)
      table.primary(['household_id', 'period'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
