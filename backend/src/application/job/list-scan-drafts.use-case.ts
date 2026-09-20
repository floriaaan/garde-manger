import type { UseCase } from '#application/shared/use-case'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { ScanDraft } from '#domain/job/scan-draft'

export class ListScanDrafts implements UseCase<{ householdId: string }, ScanDraft[]> {
  constructor(private readonly drafts: ScanDraftRepository) {}

  execute(input: { householdId: string }): Promise<ScanDraft[]> {
    return this.drafts.listPending(input.householdId)
  }
}
