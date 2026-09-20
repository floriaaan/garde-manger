import type { UseCase } from '#application/shared/use-case'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

/** Brings a hidden job back into the task center. */
export class RestoreJob implements UseCase<
  { householdId: string; jobId: string },
  ResultType<void, 'job_not_found'>
> {
  constructor(private readonly jobs: JobRepository) {}

  async execute(input: {
    householdId: string
    jobId: string
  }): Promise<ResultType<void, 'job_not_found'>> {
    const job = await this.jobs.findById(input.jobId)
    if (!job || job.householdId !== input.householdId) return Result.err('job_not_found')
    job.restore()
    await this.jobs.save(job)
    return Result.ok(undefined)
  }
}
