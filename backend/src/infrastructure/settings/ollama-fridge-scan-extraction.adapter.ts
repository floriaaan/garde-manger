import type { AiLanguage } from '#domain/shared/ai-language'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'
import { parseFridgeScanDraftJson } from '#domain/fridge/fridge-scan-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { buildFridgeScanExtractionPrompt } from '#domain/fridge/fridge-scan-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'
import { fetchWithRetry } from './fetch-with-retry.js'

export class OllamaFridgeScanExtractionAdapter implements FridgeScanExtractionPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async extract(image: Buffer, language: AiLanguage = 'fr'): Promise<FridgeScanDraft> {
    if (!this.model) throw new ReceiptExtractionUnavailableError('ollama')

    let response: Response
    try {
      response = await fetchWithRetry(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: buildFridgeScanExtractionPrompt(language),
          images: [image.toString('base64')],
          stream: false,
        }),
      })
    } catch (error) {
      logAiAdapterFailure(
        'fridge-scan-extraction',
        'ollama',
        error,
        `unreachable at ${this.baseUrl}`,
      )
      throw new ReceiptExtractionUnavailableError('ollama')
    }
    if (!response.ok) {
      logAiAdapterFailure(
        'fridge-scan-extraction',
        'ollama',
        new Error(`HTTP ${response.status}`),
        await response.text().catch(() => undefined),
      )
      throw new ReceiptExtractionUnavailableError('ollama')
    }

    const body = (await response.json()) as { response?: string }
    const text = body.response ?? ''
    try {
      return parseFridgeScanDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('fridge-scan-extraction', 'ollama', error, text.slice(0, 500))
      throw error
    }
  }
}
