import type { ReceiptDraft } from '../receipt/receipt-draft.js'
import type { FridgeScanDraft } from '../fridge/fridge-scan-draft.js'

export type JobKind = 'receipt_scan' | 'fridge_scan' | 'recipe_generation'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/** Mirrors `toJobDto` (`backend/src/presentation/job/job.dto.ts`) field-for-field. */
export interface Job {
  id: string
  kind: JobKind
  status: JobStatus
  /** One unit = one photo (or the single call of a receipt scan / recipe generation). `failed` holds unit indexes. */
  progress: { total: number; done: number; failed: number[] }
  result: { draftId?: string; recipeIds?: string[] } | null
  error: { type: string; message: string } | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  /** Hidden from the to-do list (and the badge) but still listed until deleted. */
  dismissedAt: string | null
}

/** Mirrors `toScanDraftDto`. A draft is what the AI extracted, waiting for the member to review it. */
export type ScanDraft =
  | { id: string; jobId: string; kind: 'receipt'; draft: ReceiptDraft; expiresAt: string; createdAt: string }
  | { id: string; jobId: string; kind: 'fridge'; draft: FridgeScanDraft; expiresAt: string; createdAt: string }

export function isJobActive(job: Job): boolean {
  return job.status === 'queued' || job.status === 'running'
}

/** A finished scan that missed some photos: the draft is usable, the rest can be replayed. */
export function hasPartialFailure(job: Job): boolean {
  return job.status === 'succeeded' && job.progress.failed.length > 0
}
