import { AggregateRoot } from '#domain/shared/aggregate-root'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import { HouseholdMember } from './household-member.entity.js'
import type { InviteCode } from './invite-code.vo.js'

interface HouseholdProps {
  name: string
  ownerId: string
  inviteCode: InviteCode
  members: HouseholdMember[]
  createdAt: Date
}

export class Household extends AggregateRoot<string> {
  private props: HouseholdProps

  private constructor(id: string, props: HouseholdProps) {
    super(id)
    this.props = props
  }

  static create(params: {
    id: string
    name: string
    ownerId: string
    ownerMemberId: string
    inviteCode: InviteCode
    createdAt: Date
  }): Household {
    const owner = HouseholdMember.create(params.ownerMemberId, {
      userId: params.ownerId,
      householdId: params.id,
      role: 'owner',
      joinedAt: params.createdAt,
    })

    return new Household(params.id, {
      name: params.name,
      ownerId: params.ownerId,
      inviteCode: params.inviteCode,
      members: [owner],
      createdAt: params.createdAt,
    })
  }

  /** Rehydrates an aggregate from persisted state — used by the mapper (Task 9). */
  static reconstruct(id: string, props: HouseholdProps): Household {
    return new Household(id, props)
  }

  get name(): string {
    return this.props.name
  }

  get ownerId(): string {
    return this.props.ownerId
  }

  get inviteCode(): InviteCode {
    return this.props.inviteCode
  }

  get members(): HouseholdMember[] {
    return this.props.members
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  rename(name: string): void {
    this.props.name = name
  }

  regenerateInviteCode(newCode: InviteCode): void {
    this.props.inviteCode = newCode
  }

  addMember(memberId: string, userId: string, joinedAt: Date): ResultType<void, 'already_member'> {
    if (this.props.members.some((m) => m.userId === userId)) {
      return Result.err('already_member')
    }
    this.props.members.push(
      HouseholdMember.create(memberId, { userId, householdId: this.id, role: 'member', joinedAt }),
    )
    return Result.ok(undefined)
  }

  removeMember(userId: string): ResultType<void, 'cannot_remove_owner' | 'not_a_member'> {
    if (userId === this.props.ownerId) {
      return Result.err('cannot_remove_owner')
    }
    const index = this.props.members.findIndex((m) => m.userId === userId)
    if (index === -1) {
      return Result.err('not_a_member')
    }
    this.props.members.splice(index, 1)
    return Result.ok(undefined)
  }

  /**
   * Hands the "owner" role to another current member — the current owner
   * stays in the foyer, as a member. Used both from the Foyer screen's own
   * "Transférer la propriété" action and, as a required first step, from
   * account deletion when the owner isn't the household's only member
   * (cf. `better-auth/instance.ts`'s `deleteUser.beforeDelete`).
   */
  transferOwnership(newOwnerId: string): ResultType<void, 'not_a_member' | 'already_owner'> {
    if (newOwnerId === this.props.ownerId) {
      return Result.err('already_owner')
    }
    const target = this.props.members.find((m) => m.userId === newOwnerId)
    if (!target) {
      return Result.err('not_a_member')
    }
    this.props.members = this.props.members.map((member) => {
      if (member.userId === this.props.ownerId) {
        return HouseholdMember.create(member.id, {
          userId: member.userId,
          householdId: member.householdId,
          role: 'member',
          joinedAt: member.joinedAt,
        })
      }
      if (member.userId === newOwnerId) {
        return HouseholdMember.create(member.id, {
          userId: member.userId,
          householdId: member.householdId,
          role: 'owner',
          joinedAt: member.joinedAt,
        })
      }
      return member
    })
    this.props.ownerId = newOwnerId
    return Result.ok(undefined)
  }
}
