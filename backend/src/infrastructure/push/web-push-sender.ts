import webpush from 'web-push'
import type { WebPushSender } from '#domain/push/interfaces/web-push-sender.interface'

export class VapidWebPushSender implements WebPushSender {
  constructor(
    private readonly vapid: { subject: string; publicKey: string; privateKey: string },
    private readonly onError: (error: unknown, message: string) => void,
  ) {}

  async send(messages: Parameters<WebPushSender['send']>[0]): Promise<{ invalidTokens: string[] }> {
    const invalidTokens: string[] = []
    for (const message of messages) {
      try {
        await webpush.sendNotification(
          { endpoint: message.to, keys: message.keys },
          JSON.stringify({
            title: message.title,
            body: message.body,
            route: message.data?.route ?? '/fridge',
          }),
          { vapidDetails: this.vapid, TTL: 24 * 60 * 60, timeout: 15_000 },
        )
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) invalidTokens.push(message.to)
        else this.onError(error, 'Web push failed')
      }
    }
    return { invalidTokens }
  }
}
