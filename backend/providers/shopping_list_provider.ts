import type { ListShoppingItems } from '#application/shopping-list/list-shopping-items.use-case'
import type { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'
import type { UpdateShoppingItem } from '#application/shopping-list/update-shopping-item.use-case'
import type { DeleteShoppingItem } from '#application/shopping-list/delete-shopping-item.use-case'
import type { ApplicationService } from '@adonisjs/core/types'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'

export default class ShoppingListProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind('shoppingList.listShoppingItems', async (resolver) => {
      const { ListShoppingItems } =
        await import('#application/shopping-list/list-shopping-items.use-case')
      return new ListShoppingItems(await resolver.make('shoppingList.items'))
    })

    this.app.container.bind('shoppingList.createShoppingItem', async (resolver) => {
      const { CreateShoppingItem } =
        await import('#application/shopping-list/create-shopping-item.use-case')
      return new CreateShoppingItem(
        await resolver.make('shoppingList.items'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('shoppingList.updateShoppingItem', async (resolver) => {
      const { UpdateShoppingItem } =
        await import('#application/shopping-list/update-shopping-item.use-case')
      return new UpdateShoppingItem(
        await resolver.make('shoppingList.items'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('shoppingList.deleteShoppingItem', async (resolver) => {
      const { DeleteShoppingItem } =
        await import('#application/shopping-list/delete-shopping-item.use-case')
      return new DeleteShoppingItem(await resolver.make('shoppingList.items'))
    })

    this.app.container.singleton('shoppingList.items', async () => {
      const { LucidShoppingItemRepository } =
        await import('#infrastructure/database/shopping-list/shopping-item.repository')
      return new LucidShoppingItemRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'shoppingList.listShoppingItems': ListShoppingItems
    'shoppingList.createShoppingItem': CreateShoppingItem
    'shoppingList.updateShoppingItem': UpdateShoppingItem
    'shoppingList.deleteShoppingItem': DeleteShoppingItem
    'shoppingList.items': ShoppingItemRepository
  }
}
