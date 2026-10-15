import type { GetMyHousehold } from '#application/identity/get-my-household.use-case'
import type { CreateHousehold } from '#application/identity/create-household.use-case'
import type { JoinHousehold } from '#application/identity/join-household.use-case'
import type { RenameHousehold } from '#application/identity/rename-household.use-case'
import type { RegenerateInviteCode } from '#application/identity/regenerate-invite-code.use-case'
import type { RemoveHouseholdMember } from '#application/identity/remove-household-member.use-case'
import type { LeaveHousehold } from '#application/identity/leave-household.use-case'
import type { TransferHouseholdOwnership } from '#application/identity/transfer-household-ownership.use-case'
import type { DeleteHousehold } from '#application/identity/delete-household.use-case'
import type { GetAuthMethods } from '#application/identity/get-auth-methods.use-case'
import type { ApplicationService } from '@adonisjs/core/types'
import type { UserDirectory } from '#domain/identity/interfaces/user-directory.interface'
import type { Authentication } from '#domain/identity/interfaces/authentication.interface'
import type { Session } from '#domain/identity/interfaces/session.interface'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'

export default class IdentityProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind('identity.getMyHousehold', async (resolver) => {
      const { GetMyHousehold } = await import('#application/identity/get-my-household.use-case')
      return new GetMyHousehold(await resolver.make('identity.households'))
    })

    this.app.container.bind('identity.createHousehold', async (resolver) => {
      const { CreateHousehold } = await import('#application/identity/create-household.use-case')
      return new CreateHousehold(
        await resolver.make('identity.households'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('identity.joinHousehold', async (resolver) => {
      const { JoinHousehold } = await import('#application/identity/join-household.use-case')
      return new JoinHousehold(
        await resolver.make('identity.households'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('identity.renameHousehold', async (resolver) => {
      const { RenameHousehold } = await import('#application/identity/rename-household.use-case')
      return new RenameHousehold(await resolver.make('identity.households'))
    })

    this.app.container.bind('identity.regenerateInviteCode', async (resolver) => {
      const { RegenerateInviteCode } =
        await import('#application/identity/regenerate-invite-code.use-case')
      return new RegenerateInviteCode(
        await resolver.make('identity.households'),
        await resolver.make('shared.idGenerator'),
      )
    })

    this.app.container.bind('identity.removeHouseholdMember', async (resolver) => {
      const { RemoveHouseholdMember } =
        await import('#application/identity/remove-household-member.use-case')
      return new RemoveHouseholdMember(await resolver.make('identity.households'))
    })

    this.app.container.bind('identity.leaveHousehold', async (resolver) => {
      const { LeaveHousehold } = await import('#application/identity/leave-household.use-case')
      return new LeaveHousehold(await resolver.make('identity.households'))
    })

    this.app.container.bind('identity.transferHouseholdOwnership', async (resolver) => {
      const { TransferHouseholdOwnership } =
        await import('#application/identity/transfer-household-ownership.use-case')
      return new TransferHouseholdOwnership(await resolver.make('identity.households'))
    })

    this.app.container.bind('identity.deleteHousehold', async (resolver) => {
      const { DeleteHousehold } = await import('#application/identity/delete-household.use-case')
      return new DeleteHousehold(await resolver.make('identity.households'))
    })

    this.app.container.bind('identity.getAuthMethods', async (resolver) => {
      const { GetAuthMethods } = await import('#application/identity/get-auth-methods.use-case')
      return new GetAuthMethods(await resolver.make('identity.authMethodsProvider'))
    })

    this.app.container.singleton('identity.userDirectory', async () => {
      const { BetterAuthUserDirectory } =
        await import('#infrastructure/database/identity/user-directory.repository')
      return new BetterAuthUserDirectory()
    })

    this.app.container.singleton('identity.authentication', async () => {
      const { BetterAuthAuthentication } =
        await import('#infrastructure/auth/better-auth/authentication.adapter')
      return new BetterAuthAuthentication()
    })

    this.app.container.singleton('identity.session', async () => {
      const { BetterAuthSession } = await import('#infrastructure/auth/better-auth/session.adapter')
      return new BetterAuthSession()
    })

    this.app.container.singleton('identity.authMethodsProvider', async () => {
      const { EnvAuthMethodsProvider } = await import('#infrastructure/auth/auth-methods.provider')
      return new EnvAuthMethodsProvider()
    })

    this.app.container.singleton('identity.authHandler', async () => {
      const { auth } = await import('#infrastructure/auth/better-auth/instance')
      return (request: Request) => auth.handler(request)
    })

    this.app.container.singleton('identity.households', async () => {
      const { LucidHouseholdRepository } =
        await import('#infrastructure/database/identity/household.repository')
      return new LucidHouseholdRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'identity.getMyHousehold': GetMyHousehold
    'identity.createHousehold': CreateHousehold
    'identity.joinHousehold': JoinHousehold
    'identity.renameHousehold': RenameHousehold
    'identity.regenerateInviteCode': RegenerateInviteCode
    'identity.removeHouseholdMember': RemoveHouseholdMember
    'identity.leaveHousehold': LeaveHousehold
    'identity.transferHouseholdOwnership': TransferHouseholdOwnership
    'identity.deleteHousehold': DeleteHousehold
    'identity.getAuthMethods': GetAuthMethods
    'identity.userDirectory': UserDirectory
    'identity.authentication': Authentication
    'identity.session': Session
    'identity.authMethodsProvider': AuthMethodsProvider
    'identity.authHandler': (request: Request) => Promise<Response>
    'identity.households': HouseholdRepository
  }
}
