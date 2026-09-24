import { test } from '@japa/runner'
import { ScanReceipt } from '#application/receipt/scan-receipt.use-case'
import {
  ReceiptExtractionUnavailableError,
  ReceiptExtractionParseError,
  ReceiptExtractionUnsupportedFormatError,
} from '#domain/receipt/receipt-extraction.errors'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'

const FILE = { buffer: Buffer.from(''), contentType: 'image/jpeg' }

function fakeExtraction(behavior: () => Promise<ReceiptDraft>): ReceiptExtractionPort {
  return { extract: behavior }
}

test.group('ScanReceipt', () => {
  test('returns the draft on success', async ({ assert }) => {
    const draft: ReceiptDraft = { storeName: 'Monoprix', scannedAt: new Date('2026-09-01'), totalAmount: 10, items: [] }
    const useCase = new ScanReceipt(fakeExtraction(async () => draft))
    const result = await useCase.execute({ image: FILE })
    assert.isTrue(result.ok)
    if (result.ok) assert.strictEqual(result.value, draft)
  })

  test('maps ReceiptExtractionUnavailableError to provider_not_configured', async ({ assert }) => {
    const useCase = new ScanReceipt(
      fakeExtraction(async () => {
        throw new ReceiptExtractionUnavailableError('ollama')
      }),
    )
    const result = await useCase.execute({ image: FILE })
    assert.deepEqual(result, { ok: false, error: 'provider_not_configured' })
  })

  test('maps ReceiptExtractionParseError to extraction_failed', async ({ assert }) => {
    const useCase = new ScanReceipt(
      fakeExtraction(async () => {
        throw new ReceiptExtractionParseError('bad json')
      }),
    )
    const result = await useCase.execute({ image: FILE })
    assert.deepEqual(result, { ok: false, error: 'extraction_failed' })
  })

  // A self-hosted Ollama model handed a scanned PDF: a wrong answer would be
  // worse than none, so the adapter refuses it explicitly instead of
  // guessing from raw bytes it can't read.
  test('maps ReceiptExtractionUnsupportedFormatError to unsupported_format', async ({ assert }) => {
    const useCase = new ScanReceipt(
      fakeExtraction(async () => {
        throw new ReceiptExtractionUnsupportedFormatError('ollama')
      }),
    )
    const result = await useCase.execute({ image: { buffer: Buffer.from(''), contentType: 'application/pdf' } })
    assert.deepEqual(result, { ok: false, error: 'unsupported_format' })
  })

  test('rethrows unrecognized errors', async ({ assert }) => {
    const useCase = new ScanReceipt(
      fakeExtraction(async () => {
        throw new Error('boom')
      }),
    )
    await assert.rejects(() => useCase.execute({ image: FILE }), 'boom')
  })
})
