import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The queue behind every slow AI call (receipt scan, fridge scan, recipe
 * generation). A row is both the message and its status, so the app can poll
 * `jobId` without a broker: workers claim rows with `FOR UPDATE SKIP LOCKED`
 * (cf. ADR-0016). `locked_at` is the worker's lease — a row stuck in
 * `running` past it belongs to a dead process and goes back to the queue.
 */
export default class extends BaseSchema {
  protected tableName = 'ai_job'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('created_by').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.text('kind').notNullable().checkIn(['receipt_scan', 'fridge_scan', 'recipe_generation'])
      table.text('status').notNullable().checkIn(['queued', 'running', 'succeeded', 'failed'])
      table.jsonb('input').notNullable()
      table.jsonb('progress').notNullable()
      table.jsonb('result').nullable()
      table.text('error_type').nullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('run_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('locked_at', { useTz: true }).nullable()
      table.timestamp('dismissed_at', { useTz: true }).nullable()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.text('traceparent').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['household_id', 'created_at'], 'ai_job_household_idx')
    })

    this.defer(async (db) => {
      // Partial indexes: tiny whatever the size of the history.
      await db.rawQuery(
        `CREATE INDEX "ai_job_claim_idx" ON "ai_job" ("run_at") WHERE "status" = 'queued'`,
      )
      await db.rawQuery(
        `CREATE INDEX "ai_job_running_household_idx" ON "ai_job" ("household_id") WHERE "status" = 'running'`,
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
