import { GoogleGenAI } from '@google/genai'
import type {
  ReceiptExtractionPort,
  ReceiptFile,
} from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { RECEIPT_EXTRACTION_PROMPT } from '#domain/receipt/receipt-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class GeminiReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract({ buffer, contentType }: ReceiptFile): Promise<ReceiptDraft> {
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
              { text: RECEIPT_EXTRACTION_PROMPT },
              // Gemini reads a PDF the same way it reads a photo — no separate
              // API, just the real mime type instead of a hardcoded JPEG one.
              { inlineData: { mimeType: contentType, data: buffer.toString('base64') } },
            ],
          },
        ],
      })
      text = response.text ?? ''
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'gemini', error)
      throw error
    }

    try {
      return parseReceiptDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'gemini', error, text.slice(0, 500))
      throw error
    }
  }
}
