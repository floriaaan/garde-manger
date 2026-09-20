export interface PushMessage {
  to: string
  title: string
  body: string
  /** Read by the app when the notification is tapped (`route` = where to go). */
  data?: Record<string, string>
}

export interface PushSender {
  /** Never throws: a delivery failure must not fail the job or the digest. Returns dead tokens. */
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>
}
