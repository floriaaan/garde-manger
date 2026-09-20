import type { ScanDraft } from '../scan-draft.js'

export interface ScanDraftRepository {
  findById(id: string): Promise<ScanDraft | null>
  findByJobId(jobId: string): Promise<ScanDraft | null>
  listPending(householdId: string): Promise<ScanDraft[]>
  /** Adds photos-worth of items to an existing draft (partial-retry path). */
  save(draft: ScanDraft): Promise<void>
  /** Drafts past their TTL or discarded, still holding files. */
  listPurgeable(now: Date): Promise<ScanDraft[]>
  delete(id: string): Promise<void>
}
