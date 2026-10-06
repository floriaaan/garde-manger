/** Backend `HouseholdDto` shape; image is optional for older servers. */
export type HouseholdRole = 'owner' | 'member'

export interface HouseholdMember {
  userId: string
  name: string
  image?: string | null
  role: HouseholdRole
  joinedAt: string
}

export interface Household {
  id: string
  name: string
  /**
   * Owner-only: the backend omits the field entirely for a member
   * (`toHouseholdDto` spreads it in only when the caller's role is 'owner'),
   * so the UI gates the invite section on `inviteCode`, never on `role`
   * alone.
   */
  inviteCode?: string
  role: HouseholdRole
  members: HouseholdMember[]
}
