/**
 * Domain-owned (not infrastructure-owned) specifically so the application
 * layer can import these without violating the `application-only-depends-
 * on-domain` dependency-cruiser rule — Task 9's three AI adapters throw
 * them, Task 10's `ScanReceipt` use-case catches them.
 */
export class ReceiptExtractionUnavailableError extends Error {
  constructor(public readonly provider: string) {
    super(`Receipt extraction provider "${provider}" has no credentials configured.`)
  }
}

export class ReceiptExtractionParseError extends Error {}

/** A self-hosted vision model that only reads raster images was handed a PDF. */
export class ReceiptExtractionUnsupportedFormatError extends Error {
  constructor(public readonly provider: string) {
    super(`Receipt extraction provider "${provider}" cannot read a PDF file.`)
  }
}
