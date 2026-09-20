import type { UseCase } from '#application/shared/use-case'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { Job } from '#domain/job/job.aggregate'

/** `null` for another household's job too — never confirm it exists. */
export class GetJob implements UseCase<{ householdId: string; jobId: string }, Job | null> {
  constructor(private readonly jobs: JobRepository) {}

  async execute(input: { householdId: string; jobId: string }): Promise<Job | null> {
    const job = await this.jobs.findById(input.jobId)
    return job && job.householdId === input.householdId ? job : null
  }
}
