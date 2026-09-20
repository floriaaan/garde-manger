import {
  context,
  metrics,
  trace,
  propagation,
  ROOT_CONTEXT,
  SpanStatusCode,
} from '@opentelemetry/api'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { Job } from '#domain/job/job.aggregate'
import type { Clock } from '#domain/shared/clock.interface'

const TICK_MS = 1_000
const LEASE_MS = 10 * 60_000
const PURGE_EVERY_MS = 60 * 60_000
const STOP_GRACE_MS = 30_000

export interface JobRunnerDeps {
  jobs: JobRepository
  run: (job: Job) => Promise<void>
  purge: () => Promise<void>
  clock: Clock
  maxConcurrency: number
  onError: (error: unknown, message: string) => void
}

/**
 * In-process worker over the `ai_job` table. Polls once a second, claims up to
 * `maxConcurrency` jobs (the claim itself enforces one running job per
 * household), and re-queues jobs whose lease expired — the worker that held
 * them died. Runs inside the web process: no extra service on a small host.
 */
export class JobRunner {
  private timer: NodeJS.Timeout | null = null
  private inFlight = new Set<Promise<void>>()
  private lastPurge = 0
  private ticking = false
  private stopped = false

  private readonly tracer = trace.getTracer('garde-manger.job')
  private readonly duration
  private readonly failures

  constructor(private readonly deps: JobRunnerDeps) {
    const meter = metrics.getMeter('garde-manger.job')
    this.duration = meter.createHistogram('job.duration', { unit: 'ms' })
    this.failures = meter.createCounter('job.failed')
    meter
      .createObservableGauge('job.queue.depth')
      .addCallback(async (result) => result.observe(await deps.jobs.countQueued()))
  }

  async start(): Promise<void> {
    await this.deps.jobs.requeueExpiredLeases(
      new Date(this.deps.clock.now().getTime() - LEASE_MS),
      this.deps.clock.now(),
    )
    this.timer = setInterval(() => void this.tick(), TICK_MS)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    await Promise.race([
      Promise.allSettled([...this.inFlight]),
      new Promise((resolve) => setTimeout(resolve, STOP_GRACE_MS)),
    ])
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.stopped) return
    this.ticking = true
    try {
      const now = this.deps.clock.now()
      await this.deps.jobs.requeueExpiredLeases(new Date(now.getTime() - LEASE_MS), now)
      if (now.getTime() - this.lastPurge > PURGE_EVERY_MS) {
        this.lastPurge = now.getTime()
        await this.deps.purge()
      }
      while (this.inFlight.size < this.deps.maxConcurrency && !this.stopped) {
        const job = await this.deps.jobs.claimNext(this.deps.clock.now())
        if (!job) break
        const task = this.runOne(job).finally(() => this.inFlight.delete(task))
        this.inFlight.add(task)
      }
    } catch (error) {
      this.deps.onError(error, 'job runner tick failed')
    } finally {
      this.ticking = false
    }
  }

  private async runOne(job: Job): Promise<void> {
    const startedAt = performance.now()
    const link = this.linkFrom(job.traceparent)
    const span = this.tracer.startSpan(
      'job.run',
      {
        links: link ? [link] : [],
        attributes: { 'job.id': job.id, 'job.kind': job.kind, 'job.attempt': job.attempts },
      },
      ROOT_CONTEXT,
    )
    try {
      await context.with(trace.setSpan(ROOT_CONTEXT, span), () => this.deps.run(job))
      if (job.status === 'failed' || job.status === 'queued') {
        this.failures.add(1, { kind: job.kind, error_type: job.errorType ?? 'unknown' })
        span.setStatus({ code: SpanStatusCode.ERROR, message: job.errorType ?? undefined })
      }
    } catch (error) {
      this.deps.onError(error, 'job run crashed')
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
    } finally {
      this.duration.record(performance.now() - startedAt, { kind: job.kind })
      span.end()
    }
  }

  private linkFrom(traceparent: string | null) {
    if (!traceparent) return null
    const extracted = trace.getSpanContext(propagation.extract(ROOT_CONTEXT, { traceparent }))
    return extracted ? { context: extracted } : null
  }
}
