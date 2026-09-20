import type { UseCase } from '#application/shared/use-case'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { StorageService } from '#domain/shared/interfaces/storage.interface'
import type { ScanDraft } from '#domain/job/scan-draft'

/**
 * After a successful import: the draft is spent. A receipt keeps its photo
 * (it is now `receipt.imageKey`); a fridge scan has no aggregate to hang the
 * photos on, so they go.
 */
export class FinalizeScanDraft implements UseCase<ScanDraft, void> {
  constructor(
    private readonly drafts: ScanDraftRepository,
    private readonly storage: StorageService,
  ) {}

  async execute(draft: ScanDraft): Promise<void> {
    if (draft.kind === 'fridge') for (const key of draft.imageKeys) await this.storage.delete(key)
    await this.drafts.save({ ...draft, status: 'imported' })
  }
}
