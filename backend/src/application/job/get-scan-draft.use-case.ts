import type { UseCase } from '#application/shared/use-case'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { ScanDraft } from '#domain/job/scan-draft'

/** Pending drafts of this household only — an imported or discarded one reads as gone. */
export class GetScanDraft implements UseCase<
  { householdId: string; draftId: string },
  ScanDraft | null
> {
  constructor(private readonly drafts: ScanDraftRepository) {}

  async execute(input: { householdId: string; draftId: string }): Promise<ScanDraft | null> {
    const draft = await this.drafts.findById(input.draftId)
    return draft && draft.householdId === input.householdId && draft.status === 'pending'
      ? draft
      : null
  }
}
