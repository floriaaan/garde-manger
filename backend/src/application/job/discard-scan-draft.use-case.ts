import type { UseCase } from '#application/shared/use-case'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { StorageService } from '#domain/shared/interfaces/storage.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export class DiscardScanDraft implements UseCase<
  { householdId: string; draftId: string },
  ResultType<void, 'draft_not_found'>
> {
  constructor(
    private readonly drafts: ScanDraftRepository,
    private readonly storage: StorageService,
  ) {}

  async execute(input: {
    householdId: string
    draftId: string
  }): Promise<ResultType<void, 'draft_not_found'>> {
    const draft = await this.drafts.findById(input.draftId)
    if (!draft || draft.householdId !== input.householdId || draft.status !== 'pending') {
      return Result.err('draft_not_found')
    }
    for (const key of draft.imageKeys) await this.storage.delete(key)
    await this.drafts.delete(draft.id)
    return Result.ok(undefined)
  }
}
