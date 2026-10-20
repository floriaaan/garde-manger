import type { GetHomeAssistantLink } from '#application/home-assistant/get-home-assistant-link.use-case'
import type { SaveHomeAssistantConnection } from '#application/home-assistant/save-home-assistant-connection.use-case'
import type { DiscoverTodoEntities } from '#application/home-assistant/discover-todo-entities.use-case'
import type { BindHomeAssistantList } from '#application/home-assistant/bind-home-assistant-list.use-case'
import type { UnlinkHomeAssistant } from '#application/home-assistant/unlink-home-assistant.use-case'
import type { SyncShoppingList } from '#application/home-assistant/sync-shopping-list.use-case'
import type { ApplicationService } from '@adonisjs/core/types'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { ShoppingListMirror } from '#application/home-assistant/shopping-list-mirror'

export default class HomeAssistantProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind('homeAssistant.getHomeAssistantLink', async (resolver) => {
      const { GetHomeAssistantLink } =
        await import('#application/home-assistant/get-home-assistant-link.use-case')
      return new GetHomeAssistantLink(await resolver.make('homeAssistant.links'))
    })

    this.app.container.bind('homeAssistant.saveHomeAssistantConnection', async (resolver) => {
      const { SaveHomeAssistantConnection } =
        await import('#application/home-assistant/save-home-assistant-connection.use-case')
      return new SaveHomeAssistantConnection(
        await resolver.make('homeAssistant.links'),
        await resolver.make('homeAssistant.client'),
        await resolver.make('homeAssistant.hostPolicy'),
        await resolver.make('identity.households'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('homeAssistant.discoverTodoEntities', async (resolver) => {
      const { DiscoverTodoEntities } =
        await import('#application/home-assistant/discover-todo-entities.use-case')
      return new DiscoverTodoEntities(
        await resolver.make('homeAssistant.links'),
        await resolver.make('homeAssistant.client'),
        await resolver.make('homeAssistant.hostPolicy'),
        await resolver.make('identity.households'),
      )
    })

    this.app.container.bind('homeAssistant.bindHomeAssistantList', async (resolver) => {
      const { BindHomeAssistantList } =
        await import('#application/home-assistant/bind-home-assistant-list.use-case')
      return new BindHomeAssistantList(
        await resolver.make('homeAssistant.links'),
        await resolver.make('identity.households'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('homeAssistant.unlinkHomeAssistant', async (resolver) => {
      const { UnlinkHomeAssistant } =
        await import('#application/home-assistant/unlink-home-assistant.use-case')
      return new UnlinkHomeAssistant(
        await resolver.make('homeAssistant.links'),
        await resolver.make('shoppingList.items'),
        await resolver.make('identity.households'),
      )
    })

    this.app.container.bind('homeAssistant.syncShoppingList', async (resolver) => {
      const { SyncShoppingList } =
        await import('#application/home-assistant/sync-shopping-list.use-case')
      return new SyncShoppingList(
        await resolver.make('homeAssistant.links'),
        await resolver.make('shoppingList.items'),
        await resolver.make('homeAssistant.client'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.singleton('homeAssistant.links', async () => {
      const { LucidHomeAssistantLinkRepository } =
        await import('#infrastructure/database/home-assistant/home-assistant-link.repository')
      const encryption = await this.app.container.make('shared.encryption')
      return new LucidHomeAssistantLinkRepository(encryption)
    })

    this.app.container.singleton('homeAssistant.client', async () => {
      const { HttpHomeAssistantClient } =
        await import('#infrastructure/home-assistant/http-home-assistant.client')
      return new HttpHomeAssistantClient()
    })

    this.app.container.singleton('homeAssistant.hostPolicy', async () => {
      const { EnvHostPolicy } = await import('#infrastructure/home-assistant/env-host-policy')
      return new EnvHostPolicy()
    })

    this.app.container.singleton('homeAssistant.shoppingListMirror', async () => {
      const { ShoppingListMirror } =
        await import('#application/home-assistant/shopping-list-mirror')
      const links = await this.app.container.make('homeAssistant.links')
      const client = await this.app.container.make('homeAssistant.client')
      const hostPolicy = await this.app.container.make('homeAssistant.hostPolicy')
      const clock = await this.app.container.make('shared.clock')
      return new ShoppingListMirror(links, client, hostPolicy, clock)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'homeAssistant.getHomeAssistantLink': GetHomeAssistantLink
    'homeAssistant.saveHomeAssistantConnection': SaveHomeAssistantConnection
    'homeAssistant.discoverTodoEntities': DiscoverTodoEntities
    'homeAssistant.bindHomeAssistantList': BindHomeAssistantList
    'homeAssistant.unlinkHomeAssistant': UnlinkHomeAssistant
    'homeAssistant.syncShoppingList': SyncShoppingList
    'homeAssistant.links': HomeAssistantLinkRepository
    'homeAssistant.client': HomeAssistantClient
    'homeAssistant.hostPolicy': HostPolicy
    'homeAssistant.shoppingListMirror': ShoppingListMirror
  }
}
