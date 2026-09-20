import type { UseCase } from '#application/shared/use-case'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { StorageService } from '#domain/shared/interfaces/storage.interface'
import type { Clock } from '#domain/shared/clock.interface'

const JOB_RETENTION_MS = 30 * 24 * 3_600_000

/** Expired/discarded drafts with their photos, then long-finished jobs. Imported receipts keep theirs. */
export class PurgeExpired implements UseCase<void, void> {
  constructor(
    private readonly drafts: ScanDraftRepository,
    private readonly jobs: JobRepository,
    private readonly storage: StorageService,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<void> {
    const now = this.clock.now()
    for (const draft of await this.drafts.listPurgeable(now)) {
      if (draft.status !== 'imported')
        for (const key of draft.imageKeys) await this.storage.delete(key)
      await this.drafts.delete(draft.id)
    }
    await this.jobs.deleteFinishedBefore(new Date(now.getTime() - JOB_RETENTION_MS))
  }
}
