import type { ReceiptDraft } from '../receipt/receipt-draft.js'
import type { FridgeScanDraft } from '../fridge/fridge-scan-draft.js'

export type ScanDraftKind = 'receipt' | 'fridge'
export type ScanDraftStatus = 'pending' | 'imported' | 'discarded'

/** What the AI extracted, waiting for a member to review it. Never edited server-side. */
export interface ScanDraft {
  id: string
  householdId: string
  jobId: string
  kind: ScanDraftKind
  payload: ReceiptDraft | FridgeScanDraft
  /** `shared.storage` keys — attached to the receipt on import, purged otherwise. */
  imageKeys: string[]
  status: ScanDraftStatus
  expiresAt: Date
  createdAt: Date
}
