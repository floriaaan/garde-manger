import type { PushMessage } from './push-sender.interface.js'

export interface WebPushSender {
  send(messages: (PushMessage & { keys: { p256dh: string; auth: string } })[]): Promise<{ invalidTokens: string[] }>
}
