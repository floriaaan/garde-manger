import type { ReceiptExtractionPort, ReceiptFile } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import {
  ReceiptExtractionUnavailableError,
  ReceiptExtractionUnsupportedFormatError,
} from '#domain/receipt/receipt-extraction.errors'
import { RECEIPT_EXTRACTION_PROMPT } from '#domain/receipt/receipt-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'
import { fetchWithRetry } from './fetch-with-retry.js'

export class OllamaReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async extract({ buffer, contentType }: ReceiptFile): Promise<ReceiptDraft> {
    if (!this.model) throw new ReceiptExtractionUnavailableError('ollama')
    // Ollama's `/api/generate` `images` field is a raster-image slot — a
    // local vision model reads pixels, not a PDF's page/text structure, and
    // sending it one produces a confident wrong answer rather than a clean
    // failure. Only Gemini and OpenAI's hosted APIs actually parse a PDF.
    if (contentType === 'application/pdf') throw new ReceiptExtractionUnsupportedFormatError('ollama')

    let response: Response
    try {
      response = await fetchWithRetry(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: RECEIPT_EXTRACTION_PROMPT,
          images: [buffer.toString('base64')],
          stream: false,
        }),
      })
    } catch (error) {
      // Unreachable host — never surfaced before, silently became the same
      // generic "provider not configured" as a genuinely missing model.
      logAiAdapterFailure('receipt-extraction', 'ollama', error, `unreachable at ${this.baseUrl}`)
      throw new ReceiptExtractionUnavailableError('ollama')
    }
    if (!response.ok) {
      logAiAdapterFailure(
        'receipt-extraction',
        'ollama',
        new Error(`HTTP ${response.status}`),
        await response.text().catch(() => undefined),
      )
      throw new ReceiptExtractionUnavailableError('ollama')
    }

    const body = (await response.json()) as { response?: string }
    const text = body.response ?? ''
    try {
      return parseReceiptDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'ollama', error, text.slice(0, 500))
      throw error
    }
  }
}
