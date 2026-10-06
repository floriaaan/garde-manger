import { GoogleGenAI } from '@google/genai'
import type { AiLanguage } from '#domain/shared/ai-language'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'
import { parseFridgeScanDraftJson } from '#domain/fridge/fridge-scan-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { buildFridgeScanExtractionPrompt } from '#domain/fridge/fridge-scan-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class GeminiFridgeScanExtractionAdapter implements FridgeScanExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract(image: Buffer, language: AiLanguage = 'fr'): Promise<FridgeScanDraft> {
    if (!this.apiKey) throw new ReceiptExtractionUnavailableError('gemini')

    const client = new GoogleGenAI({ apiKey: this.apiKey })
    let text: string
    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildFridgeScanExtractionPrompt(language) },
              { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } },
            ],
          },
        ],
      })
      text = response.text ?? ''
    } catch (error) {
      logAiAdapterFailure('fridge-scan-extraction', 'gemini', error)
      throw error
    }

    try {
      return parseFridgeScanDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('fridge-scan-extraction', 'gemini', error, text.slice(0, 500))
      throw error
    }
  }
}
