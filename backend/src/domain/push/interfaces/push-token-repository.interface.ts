import type { DigestTarget, PushToken } from '../push-token.js'

export interface PushTokenRepository {
  /** Insert, or move an already known token to `userId`. */
  upsert(token: PushToken): Promise<void>
  /** Only the owner can remove a token. */
  deleteForUser(userId: string, token: string): Promise<void>
  /** Tokens Expo reported as dead. */
  deleteMany(tokens: string[]): Promise<void>
  listForUser(userId: string): Promise<string[]>
  /** Tokens whose member has a household and was not sent the digest of `day` (`YYYY-MM-DD`). */
  listDigestDue(day: string): Promise<DigestTarget[]>
  markDigested(tokens: string[], day: string): Promise<void>
}
