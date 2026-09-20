import type { UseCase } from '#application/shared/use-case'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { StorageService } from '#domain/shared/interfaces/storage.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Job } from '#domain/job/job.aggregate'
import type { JobKind } from '#domain/job/job.aggregate'

export interface EnqueueJobInput {
  householdId: string
  createdBy: string
  kind: JobKind
  /** Scans only — the worker runs after the HTTP response, so the photos must outlive the request. */
  images?: { buffer: Buffer; contentType: string }[]
  prompt?: string
  traceparent: string | null
}

export class EnqueueJob implements UseCase<EnqueueJobInput, Job> {
  constructor(
    private readonly jobs: JobRepository,
    private readonly storage: StorageService,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: EnqueueJobInput): Promise<Job> {
    const id = this.idGenerator.next()
    const images = input.images ?? []

    const imageKeys: string[] = []
    for (const [index, image] of images.entries()) {
      const key = `scan/${input.householdId}/${id}/${index}`
      await this.storage.save(key, image.buffer, image.contentType)
      imageKeys.push(key)
    }

    const job = Job.create({
      id,
      householdId: input.householdId,
      createdBy: input.createdBy,
      kind: input.kind,
      input: input.kind === 'recipe_generation' ? { prompt: input.prompt } : { imageKeys },
      total: input.kind === 'recipe_generation' ? 1 : imageKeys.length,
      traceparent: input.traceparent,
      now: this.clock.now(),
    })
    await this.jobs.save(job)
    return job
  }
}
