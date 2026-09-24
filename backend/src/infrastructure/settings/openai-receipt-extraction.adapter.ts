import OpenAI from 'openai'
import type { ReceiptExtractionPort, ReceiptFile } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { RECEIPT_EXTRACTION_PROMPT } from '#domain/receipt/receipt-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class OpenAiReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract({ buffer, contentType }: ReceiptFile): Promise<ReceiptDraft> {
    if (!this.apiKey) throw new ReceiptExtractionUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    const isPdf = contentType === 'application/pdf'
    let text: string
    try {
      // Chat Completions' `image_url` part only ever decodes an image — a
      // PDF there comes back as a hallucinated read, not an error, which is
      // worse than not supporting it. The Responses API's `input_file` part
      // is OpenAI's real PDF path (it renders each page itself before the
      // model sees it), so a scanned ticket takes that route and a photo
      // keeps the call this adapter always made.
      if (isPdf) {
        const response = await client.responses.create({
          model: 'gpt-4o-mini',
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: RECEIPT_EXTRACTION_PROMPT },
                {
                  type: 'input_file',
                  filename: 'receipt.pdf',
                  file_data: `data:${contentType};base64,${buffer.toString('base64')}`,
                },
              ],
            },
          ],
        })
        text = response.output_text ?? ''
      } else {
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: RECEIPT_EXTRACTION_PROMPT },
                {
                  type: 'image_url',
                  image_url: { url: `data:${contentType};base64,${buffer.toString('base64')}` },
                },
              ],
            },
          ],
        })
        text = response.choices[0]?.message.content ?? ''
      }
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'openai', error)
      throw error
    }

    try {
      return parseReceiptDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'openai', error, text.slice(0, 500))
      throw error
    }
  }
}
