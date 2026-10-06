import OpenAI from 'openai'
import type { AiLanguage } from '#domain/shared/ai-language'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'
import { parseFridgeScanDraftJson } from '#domain/fridge/fridge-scan-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { buildFridgeScanExtractionPrompt } from '#domain/fridge/fridge-scan-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class OpenAiFridgeScanExtractionAdapter implements FridgeScanExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract(image: Buffer, language: AiLanguage = 'fr'): Promise<FridgeScanDraft> {
    if (!this.apiKey) throw new ReceiptExtractionUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    let text: string
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildFridgeScanExtractionPrompt(language) },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
              },
            ],
          },
        ],
      })
      text = response.choices[0]?.message.content ?? ''
    } catch (error) {
      logAiAdapterFailure('fridge-scan-extraction', 'openai', error)
      throw error
    }

    try {
      return parseFridgeScanDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('fridge-scan-extraction', 'openai', error, text.slice(0, 500))
      throw error
    }
  }
}
