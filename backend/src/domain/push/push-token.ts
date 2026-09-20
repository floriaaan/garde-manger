export type PushPlatform = 'ios' | 'android'

export interface PushToken {
  id: string
  userId: string
  /** Expo push token, `ExponentPushToken[...]`. */
  token: string
  platform: PushPlatform
}

/** A token that still owes its member today's digest. */
export interface DigestTarget {
  token: string
  userId: string
  householdId: string
}
