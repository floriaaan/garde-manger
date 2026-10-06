import type { AiLanguage } from '#domain/shared/ai-language'
import type { FridgeScanDraft } from '../fridge-scan-draft.js'

/**
 * One image per call — a fridge scan sends N photos through N calls (see
 * `ScanFridge`), not one multi-image call: it keeps every adapter on the
 * same single-image contract `ReceiptExtractionPort` already uses, and some
 * local vision models (Ollama) only read the first image of a multi-image
 * message anyway.
 */
export interface FridgeScanExtractionPort {
  extract(image: Buffer, language?: AiLanguage): Promise<FridgeScanDraft>
}
