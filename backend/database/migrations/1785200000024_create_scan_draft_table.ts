import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * What a scan extracted, kept until a member reviews it (cf. ADR-0017).
 * `payload` is opaque to SQL — nothing queries inside it, and its shape is
 * already owned by the domain parsers — hence `jsonb`, not an item table.
 */
export default class extends BaseSchema {
  protected tableName = 'scan_draft'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('job_id').notNullable().references('id').inTable('ai_job').onDelete('CASCADE')
      table.text('kind').notNullable().checkIn(['receipt', 'fridge'])
      table.jsonb('payload').notNullable()
      table.jsonb('image_keys').notNullable()
      table.text('status').notNullable().checkIn(['pending', 'imported', 'discarded'])
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['household_id', 'status', 'created_at'])
      table.index('job_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
