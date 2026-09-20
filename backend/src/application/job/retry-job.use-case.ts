import type { UseCase } from '#application/shared/use-case'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { Job } from '#domain/job/job.aggregate'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export type RetryJobError = 'job_not_found' | 'job_not_retryable'

/** Failed jobs, and succeeded scans that missed some photos (only those replay). */
export class RetryJob implements UseCase<
  { householdId: string; jobId: string },
  ResultType<Job, RetryJobError>
> {
  constructor(
    private readonly jobs: JobRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    householdId: string
    jobId: string
  }): Promise<ResultType<Job, RetryJobError>> {
    const job = await this.jobs.findById(input.jobId)
    if (!job || job.householdId !== input.householdId) return Result.err('job_not_found')
    const partial = job.status === 'succeeded' && job.progress.failed.length > 0
    if (job.status !== 'failed' && !partial) return Result.err('job_not_retryable')
    job.requeue(this.clock.now())
    await this.jobs.save(job)
    return Result.ok(job)
  }
}
