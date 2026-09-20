import type { UseCase } from '#application/shared/use-case'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { Job } from '#domain/job/job.aggregate'

const FINISHED_VISIBLE_MS = 24 * 3_600_000

export class ListJobs implements UseCase<{ householdId: string }, Job[]> {
  constructor(
    private readonly jobs: JobRepository,
    private readonly clock: Clock,
  ) {}

  execute(input: { householdId: string }): Promise<Job[]> {
    const since = new Date(this.clock.now().getTime() - FINISHED_VISIBLE_MS)
    return this.jobs.listForHousehold(input.householdId, since)
  }
}
