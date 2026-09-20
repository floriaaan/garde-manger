import type { Job } from '../job.aggregate.js'
import type { ScanDraft } from '../scan-draft.js'

export interface JobRepository {
  save(job: Job): Promise<void>
  /** Job and draft commit together — never a finished job without a readable draft. */
  saveWithDraft(job: Job, draft: ScanDraft): Promise<void>
  findById(id: string): Promise<Job | null>
  /** Active jobs, plus finished ones since `since`; dismissed ones included, flagged by `dismissedAt`. */
  listForHousehold(householdId: string, since: Date): Promise<Job[]>
  /** Atomically claims one runnable job (one running job per household). `null` = nothing to do. */
  claimNext(now: Date): Promise<Job | null>
  /** Puts back in the queue jobs whose worker died mid-flight. Returns how many. */
  requeueExpiredLeases(before: Date, now: Date): Promise<number>
  delete(id: string): Promise<void>
  countQueued(): Promise<number>
  deleteFinishedBefore(before: Date): Promise<number>
}
