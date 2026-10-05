import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('recipe', (table) => {
      table.boolean('is_archived').notNullable().defaultTo(false)
      table.boolean('is_favorite').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('recipe', (table) => {
      table.dropColumns('is_archived', 'is_favorite')
    })
  }
}
