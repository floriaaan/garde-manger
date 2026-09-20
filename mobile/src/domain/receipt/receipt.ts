import type { LocationValue } from '../fridge/location.js'

/** Mirrors `ReceiptDto` (`backend/src/presentation/receipt/receipt.dto.ts`) field-for-field. */
export interface Receipt {
  id: string
  storeName: string
  scannedAt: string
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: string
}

/**
 * Mirrors `importReceiptValidator` (`backend/src/presentation/receipt/
 * receipt.validator.ts`) — `location`/`expiresAt` aren't on `ReceiptDraftItem`
 * (the backend only requires them at import time), so the review screen
 * collects them before submitting.
 */
export interface ImportReceiptItemInput {
  name: string
  quantity: number
  unit: string
  category?: string | null
  price?: number | null
  location: LocationValue
  expiresAt?: string | null
}

export interface ImportReceiptInput {
  /** The scan draft this import comes from — the server then keeps its photo on the receipt. */
  draftId?: string
  storeName: string
  scannedAt: string
  totalAmount: number
  items: ImportReceiptItemInput[]
}
