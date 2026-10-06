import type { Household } from '#domain/identity/household.aggregate'
import type { User } from '#domain/identity/user.entity'
import type { HouseholdRole } from '#domain/identity/household-role.vo'

export interface HouseholdMemberDto {
  userId: string
  name: string
  image: string | null
  role: HouseholdRole
  joinedAt: string
}

export interface HouseholdDto {
  id: string
  name: string
  inviteCode?: string
  role: HouseholdRole
  members: HouseholdMemberDto[]
}

/**
 * `inviteCode` is only included for the caller's own role being 'owner' —
 * cf. docs/phase-0/04-endpoints-http.md.
 */
export function toHouseholdDto(
  household: Household,
  callerUserId: string,
  members: User[],
): HouseholdDto {
  const memberById = new Map(members.map((u) => [u.id, u]))
  const caller = household.members.find((m) => m.userId === callerUserId)
  if (!caller) throw new Error(`toHouseholdDto: caller ${callerUserId} is not a member`)

  return {
    id: household.id,
    name: household.name,
    role: caller.role,
    ...(caller.role === 'owner' ? { inviteCode: household.inviteCode.value } : {}),
    members: household.members.map((m) => ({
      userId: m.userId,
      name: memberById.get(m.userId)?.name ?? 'Utilisateur inconnu',
      image: memberById.get(m.userId)?.image ?? null,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  }
}
