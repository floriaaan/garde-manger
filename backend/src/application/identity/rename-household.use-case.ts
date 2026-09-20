import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { Household } from '#domain/identity/household.aggregate'

export interface RenameHouseholdInput {
  userId: string
  name: string
}

export type RenameHouseholdError = 'no_household' | 'not_owner'

export class RenameHousehold implements UseCase<
  RenameHouseholdInput,
  ResultType<Household, RenameHouseholdError>
> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(input: RenameHouseholdInput): Promise<ResultType<Household, RenameHouseholdError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    household.rename(input.name)
    await this.households.save(household)
    return Result.ok(household)
  }
}
