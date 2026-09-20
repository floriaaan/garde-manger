import type { PushMessage, PushSender } from '#domain/push/interfaces/push-sender.interface'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100 // Expo's documented per-request maximum.

interface ExpoTicket {
  status: 'ok' | 'error'
  details?: { error?: string }
}

/** Expo Push API. A failed batch is logged and dropped: a missed push is not worth failing a job. */
export class ExpoPushSender implements PushSender {
  constructor(
    private readonly accessToken: string | undefined,
    private readonly onError: (error: unknown, message: string) => void,
  ) {}

  async send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }> {
    const invalidTokens: string[] = []
    for (let start = 0; start < messages.length; start += BATCH_SIZE) {
      const batch = messages.slice(start, start + BATCH_SIZE)
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(batch.map((message) => ({ ...message, sound: 'default' }))),
          signal: AbortSignal.timeout(15_000),
        })
        if (!response.ok) throw new Error(`Expo push API answered ${response.status}`)
        const { data } = (await response.json()) as { data: ExpoTicket[] }
        data.forEach((ticket, index) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(batch[index]!.to)
          }
        })
      } catch (error) {
        this.onError(error, 'Expo push batch failed')
      }
    }
    return { invalidTokens }
  }
}
