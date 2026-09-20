import type { UseCase } from '#application/shared/use-case'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { StorageService } from '#domain/shared/interfaces/storage.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

/**
 * A queued job is cancelled (row and photos gone); a finished one is hidden
 * from the task center. A running one is left alone — the provider call is
 * already paid for, interrupting it saves nothing.
 */
export class DismissJob implements UseCase<
  { householdId: string; jobId: string },
  ResultType<void, 'job_not_found'>
> {
  constructor(
    private readonly jobs: JobRepository,
    private readonly storage: StorageService,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    householdId: string
    jobId: string
  }): Promise<ResultType<void, 'job_not_found'>> {
    const job = await this.jobs.findById(input.jobId)
    if (!job || job.householdId !== input.householdId) return Result.err('job_not_found')

    if (job.status === 'queued') {
      for (const key of job.input.imageKeys ?? []) await this.storage.delete(key)
      await this.jobs.delete(job.id)
    } else if (job.status !== 'running') {
      job.dismiss(this.clock.now())
      await this.jobs.save(job)
    }
    return Result.ok(undefined)
  }
}
