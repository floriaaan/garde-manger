import type { AiLanguage } from '#domain/shared/ai-language'
import type { ReceiptDraft } from '../receipt-draft.js'

export interface ReceiptFile {
  buffer: Buffer
  /** `image/jpeg`, `image/png`, `image/webp`, or `application/pdf` — a receipt can be a photo or a scanned PDF. */
  contentType: string
}

export interface ReceiptExtractionPort {
  extract(file: ReceiptFile, language?: AiLanguage): Promise<ReceiptDraft>
}
