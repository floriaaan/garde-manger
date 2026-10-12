import type { Session } from '../../../domain/identity/session.js'
import type { Household, HouseholdMember } from '../../../domain/identity/household.js'

export function isValidSession(session: Session | undefined): session is Session {
  return typeof session?.user?.id === 'string' && Boolean(session.user.id)
    && typeof session.user.name === 'string' && typeof session.user.email === 'string'
    && (session.user.image === null || typeof session.user.image === 'string')
}

function isValidHouseholdMember(member: HouseholdMember): boolean {
  return typeof member.userId === 'string' && typeof member.name === 'string'
    && typeof member.joinedAt === 'string' && ['owner', 'member'].includes(member.role)
}

export function isValidHousehold(household: Household | undefined): household is Household {
  return typeof household?.id === 'string' && Boolean(household.id)
    && typeof household.name === 'string' && ['owner', 'member'].includes(household.role)
    && Array.isArray(household.members) && household.members.every(isValidHouseholdMember)
}

export function hasHouseholdMembership(session: Session, household: Household): boolean {
  return household.members.some((member) => member.userId === session.user.id)
}
