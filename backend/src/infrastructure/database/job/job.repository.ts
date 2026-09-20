import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Job } from '#domain/job/job.aggregate'
import type {
  JobKind,
  JobStatus,
  JobInput,
  JobProgress,
  JobResult,
} from '#domain/job/job.aggregate'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { ScanDraft } from '#domain/job/scan-draft'
import { insertOrReplaceDraft } from './scan-draft.repository.js'

interface JobRow {
  id: string
  household_id: string
  created_by: string
  kind: JobKind
  status: JobStatus
  input: JobInput
  progress: JobProgress
  result: JobResult | null
  error_type: string | null
  attempts: number
  run_at: Date
  locked_at: Date | null
  dismissed_at: Date | null
  started_at: Date | null
  finished_at: Date | null
  traceparent: string | null
  created_at: Date
}

function toDomain(row: JobRow): Job {
  return Job.reconstruct({
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    kind: row.kind,
    status: row.status,
    input: row.input,
    progress: row.progress,
    result: row.result,
    errorType: row.error_type,
    attempts: row.attempts,
    runAt: row.run_at,
    lockedAt: row.locked_at,
    dismissedAt: row.dismissed_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    traceparent: row.traceparent,
    createdAt: row.created_at,
  })
}

async function upsert(job: Job, trx?: TransactionClientContract): Promise<void> {
  const client = trx ?? db
  await client.rawQuery(
    `insert into ai_job (id, household_id, created_by, kind, status, input, progress, result,
       error_type, attempts, run_at, locked_at, dismissed_at, started_at, finished_at, traceparent, created_at)
     values (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (id) do update set
       status = excluded.status, input = excluded.input, progress = excluded.progress,
       result = excluded.result, error_type = excluded.error_type, attempts = excluded.attempts,
       run_at = excluded.run_at, locked_at = excluded.locked_at, dismissed_at = excluded.dismissed_at,
       started_at = excluded.started_at, finished_at = excluded.finished_at`,
    [
      job.id,
      job.householdId,
      job.createdBy,
      job.kind,
      job.status,
      JSON.stringify(job.input),
      JSON.stringify(job.progress),
      job.result ? JSON.stringify(job.result) : null,
      job.errorType,
      job.attempts,
      job.runAt,
      job.lockedAt,
      job.dismissedAt,
      job.startedAt,
      job.finishedAt,
      job.traceparent,
      job.createdAt,
    ],
  )
}

export class LucidJobRepository implements JobRepository {
  async save(job: Job): Promise<void> {
    await upsert(job)
  }

  async saveWithDraft(job: Job, draft: ScanDraft): Promise<void> {
    await db.transaction(async (trx) => {
      await upsert(job, trx)
      await insertOrReplaceDraft(draft, trx)
    })
  }

  async findById(id: string): Promise<Job | null> {
    const row = await db.from('ai_job').where('id', id).first()
    return row ? toDomain(row as JobRow) : null
  }

  async listForHousehold(householdId: string, since: Date): Promise<Job[]> {
    const rows = await db
      .from('ai_job')
      .where('household_id', householdId)
      .whereNull('dismissed_at')
      .where((q) => q.whereIn('status', ['queued', 'running']).orWhere('finished_at', '>=', since))
      .orderBy('created_at', 'desc')
      .limit(20)
    return rows.map((row) => toDomain(row as JobRow))
  }

  /**
   * One statement, no SELECT-then-UPDATE: `skip locked` means two workers (or
   * two nodes) never take the same row and never wait on each other, and the
   * `not in (running)` filter keeps a household to one AI call at a time —
   * its quota and the provider's rate limit are shared.
   */
  async claimNext(now: Date): Promise<Job | null> {
    const result = await db.rawQuery(
      `update ai_job
          set status = 'running', locked_at = ?, attempts = attempts + 1,
              started_at = coalesce(started_at, ?)
        where id = (
          select id from ai_job
           where status = 'queued'
             and run_at <= ?
             and household_id not in (select household_id from ai_job where status = 'running')
           order by run_at
             for update skip locked
           limit 1
        )
        returning *`,
      [now, now, now],
    )
    const row = result.rows[0] as JobRow | undefined
    return row ? toDomain(row) : null
  }

  async requeueExpiredLeases(before: Date, now: Date): Promise<number> {
    const result = await db.rawQuery(
      `update ai_job set status = 'queued', locked_at = null, run_at = ?
        where status = 'running' and locked_at < ?`,
      [now, before],
    )
    return result.rowCount ?? 0
  }

  async delete(id: string): Promise<void> {
    await db.from('ai_job').where('id', id).delete()
  }

  async countQueued(): Promise<number> {
    const row = await db.from('ai_job').where('status', 'queued').count('* as total').first()
    return Number(row?.total ?? 0)
  }

  async deleteFinishedBefore(before: Date): Promise<number> {
    const deleted = await db
      .from('ai_job')
      .whereIn('status', ['succeeded', 'failed'])
      .where('finished_at', '<', before)
      .delete()
    return Number(deleted)
  }
}
