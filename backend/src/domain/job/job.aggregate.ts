import { nextAttemptAt } from './retry-policy.js'

export type JobKind = 'receipt_scan' | 'fridge_scan' | 'recipe_generation'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/** One unit = one photo (or the single call of a receipt scan / recipe generation). */
export interface JobProgress {
  total: number
  done: number
  failed: number[]
}

export interface JobInput {
  imageKeys?: string[]
  prompt?: string
}

export interface JobResult {
  draftId?: string
  recipeIds?: string[]
}

export interface JobProps {
  id: string
  householdId: string
  createdBy: string
  kind: JobKind
  status: JobStatus
  input: JobInput
  progress: JobProgress
  result: JobResult | null
  errorType: string | null
  attempts: number
  runAt: Date
  lockedAt: Date | null
  dismissedAt: Date | null
  startedAt: Date | null
  finishedAt: Date | null
  /** W3C `traceparent` of the enqueuing request, so the worker's span can link back to it. */
  traceparent: string | null
  createdAt: Date
}

export class Job {
  private constructor(private props: JobProps) {}

  static create(input: {
    id: string
    householdId: string
    createdBy: string
    kind: JobKind
    input: JobInput
    total: number
    traceparent: string | null
    now: Date
  }): Job {
    return new Job({
      id: input.id,
      householdId: input.householdId,
      createdBy: input.createdBy,
      kind: input.kind,
      status: 'queued',
      input: input.input,
      progress: { total: input.total, done: 0, failed: [] },
      result: null,
      errorType: null,
      attempts: 0,
      runAt: input.now,
      lockedAt: null,
      dismissedAt: null,
      startedAt: null,
      finishedAt: null,
      traceparent: input.traceparent,
      createdAt: input.now,
    })
  }

  static reconstruct(props: JobProps): Job {
    return new Job(props)
  }

  get id() {
    return this.props.id
  }
  get householdId() {
    return this.props.householdId
  }
  get createdBy() {
    return this.props.createdBy
  }
  get kind() {
    return this.props.kind
  }
  get status() {
    return this.props.status
  }
  get input() {
    return this.props.input
  }
  get progress() {
    return this.props.progress
  }
  get result() {
    return this.props.result
  }
  get errorType() {
    return this.props.errorType
  }
  get attempts() {
    return this.props.attempts
  }
  get runAt() {
    return this.props.runAt
  }
  get lockedAt() {
    return this.props.lockedAt
  }
  get dismissedAt() {
    return this.props.dismissedAt
  }
  get startedAt() {
    return this.props.startedAt
  }
  get finishedAt() {
    return this.props.finishedAt
  }
  get traceparent() {
    return this.props.traceparent
  }
  get createdAt() {
    return this.props.createdAt
  }

  get active(): boolean {
    return this.props.status === 'queued' || this.props.status === 'running'
  }

  /** Units this run must attempt: the whole set, or — once a draft exists — only the ones that failed. */
  pendingUnits(): number[] {
    const { total, failed } = this.props.progress
    if (this.props.result?.draftId) return failed
    return Array.from({ length: total }, (_, i) => i)
  }

  /** A run without a draft starts from scratch, so counters from a previous attempt must not stack. */
  beginRun(): void {
    if (this.props.result?.draftId) return
    this.props.progress = { ...this.props.progress, done: 0, failed: [] }
  }

  recordUnit(index: number, ok: boolean): void {
    const { progress } = this.props
    const failed = progress.failed.filter((i) => i !== index)
    if (ok) {
      this.props.progress = { ...progress, done: progress.done + 1, failed }
    } else {
      this.props.progress = { ...progress, failed: [...failed, index].sort((a, b) => a - b) }
    }
  }

  succeed(result: JobResult, now: Date): void {
    this.props.status = 'succeeded'
    this.props.result = result
    this.props.errorType = null
    this.props.lockedAt = null
    this.props.finishedAt = now
  }

  /** Re-queues with backoff when the error is worth retrying, otherwise fails for good. */
  fail(errorType: string, now: Date): void {
    const retryAt = nextAttemptAt(errorType, this.props.attempts, now)
    this.props.lockedAt = null
    if (retryAt) {
      this.props.status = 'queued'
      this.props.runAt = retryAt
      return
    }
    this.props.status = 'failed'
    this.props.errorType = errorType
    this.props.finishedAt = now
  }

  /** User-triggered retry: fresh attempt budget, runs now. Keeps the draft so only missing units replay. */
  requeue(now: Date): void {
    this.props.status = 'queued'
    this.props.errorType = null
    this.props.attempts = 0
    this.props.runAt = now
    this.props.lockedAt = null
    this.props.finishedAt = null
    if (!this.props.result?.draftId) {
      this.props.progress = { ...this.props.progress, done: 0, failed: [] }
    }
  }

  dismiss(now: Date): void {
    this.props.dismissedAt = now
  }

  restore(): void {
    this.props.dismissedAt = null
  }
}
