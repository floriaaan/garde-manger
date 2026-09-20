import type { PushSender } from '#domain/push/interfaces/push-sender.interface'

/** `PUSH_ENABLED=false`: registration still works, nothing leaves the server. */
export class NoopPushSender implements PushSender {
  async send(): Promise<{ invalidTokens: string[] }> {
    return { invalidTokens: [] }
  }
}
