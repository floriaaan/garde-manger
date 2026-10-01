import type { UseCase } from '#application/shared/use-case'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'
import {
  ReceiptExtractionUnavailableError,
  ReceiptExtractionParseError,
} from '#domain/receipt/receipt-extraction.errors'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export type ScanFridgeError = 'provider_not_configured' | 'extraction_failed'

/** One photo per provider call; the job worker merges photos and counts the entire scan as one quota unit. */
export class ScanFridge implements UseCase<
  { image: Buffer },
  ResultType<FridgeScanDraft, ScanFridgeError>
> {
  constructor(private readonly extraction: FridgeScanExtractionPort) {}

  async execute(input: { image: Buffer }): Promise<ResultType<FridgeScanDraft, ScanFridgeError>> {
    try {
      const draft = await this.extraction.extract(input.image)
      return Result.ok(draft)
    } catch (error) {
      if (error instanceof ReceiptExtractionUnavailableError)
        return Result.err('provider_not_configured')
      if (error instanceof ReceiptExtractionParseError) return Result.err('extraction_failed')
      throw error
    }
  }
}
