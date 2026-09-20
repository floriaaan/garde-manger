import type { Job } from '#domain/job/job.aggregate'
import type { ScanDraft } from '#domain/job/scan-draft'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'
import { serializeError } from '#presentation/shared/error-serializer'
import { toReceiptDraftDto } from '#presentation/receipt/receipt.dto'
import { toFridgeScanDraftDto } from '#presentation/fridge/fridge-scan.dto'

export function toJobDto(job: Job) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.errorType
      ? { type: job.errorType, message: serializeError(job.errorType).body.error.message }
      : null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  }
}

export function toScanDraftDto(draft: ScanDraft) {
  return {
    id: draft.id,
    jobId: draft.jobId,
    kind: draft.kind,
    draft:
      draft.kind === 'receipt'
        ? toReceiptDraftDto(draft.payload as ReceiptDraft)
        : toFridgeScanDraftDto(draft.payload as FridgeScanDraft),
    expiresAt: draft.expiresAt.toISOString(),
    createdAt: draft.createdAt.toISOString(),
  }
}
