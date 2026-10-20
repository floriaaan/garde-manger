import { resolveBinding } from '#presentation/shared/resolve-binding'
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  createShoppingItemValidator,
  updateShoppingItemValidator,
} from './shopping-item.validator.js'
import { toShoppingItemDto } from './shopping-item.dto.js'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'
import { ListShoppingItems } from '#application/shopping-list/list-shopping-items.use-case'
import { UpdateShoppingItem } from '#application/shopping-list/update-shopping-item.use-case'
import { DeleteShoppingItem } from '#application/shopping-list/delete-shopping-item.use-case'

export default class ShoppingItemController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'shopping_list',
      ListShoppingItems,
      async () => {
        const listShoppingItems = await resolveBinding(ctx, 'shoppingList.listShoppingItems')
        const result = await listShoppingItems.execute({ householdId: ctx.household.id })
        ctx.response.json({ items: result.map(toShoppingItemDto) })
      },
      { action: 'shopping_list.get_items' },
    )
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'shopping_list',
      CreateShoppingItem,
      async () => {
        const payload = await ctx.request.validateUsing(createShoppingItemValidator)

        const createShoppingItem = await resolveBinding(ctx, 'shoppingList.createShoppingItem')
        const result = await createShoppingItem.execute({
          householdId: ctx.household.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        const mirror = await resolveBinding(ctx, 'homeAssistant.shoppingListMirror')
        // A merge (`created: false`) touched an existing line — HA already has
        // it, so this must update that entry, not add a second one.
        if (result.value.created) {
          await mirror.itemCreated(result.value.item)
        } else {
          await mirror.itemUpdated(result.value.item)
        }
        ctx.response.status(201).json({ item: toShoppingItemDto(result.value.item) })
        return result
      },
      {
        isError: (r) => !r.ok,
        entityId: (r) => (r.ok ? r.value.item.id : undefined),
        action: 'shopping_list.create_item',
      },
    )
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'shopping_list',
      UpdateShoppingItem,
      async () => {
        const payload = await ctx.request.validateUsing(updateShoppingItemValidator)

        const updateShoppingItem = await resolveBinding(ctx, 'shoppingList.updateShoppingItem')
        const result = await updateShoppingItem.execute({
          householdId: ctx.household.id,
          itemId: ctx.params.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        const mirror = await resolveBinding(ctx, 'homeAssistant.shoppingListMirror')
        await mirror.itemUpdated(result.value)
        ctx.response.json({ item: toShoppingItemDto(result.value) })
        return result
      },
      { isError: (r) => !r.ok, action: 'shopping_list.update_item' },
    )
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'shopping_list',
      DeleteShoppingItem,
      async () => {
        const items = await resolveBinding(ctx, 'shoppingList.items')
        // Fetched before the delete so its haUid is still known — DeleteShoppingItem
        // does its own lookup internally and returns void, not the deleted item.
        const existing = await items.findById(ctx.params.id)
        const deleteShoppingItem = await resolveBinding(ctx, 'shoppingList.deleteShoppingItem')
        const result = await deleteShoppingItem.execute({
          householdId: ctx.household.id,
          itemId: ctx.params.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        const mirror = await resolveBinding(ctx, 'homeAssistant.shoppingListMirror')
        await mirror.itemDeleted(ctx.household.id, existing?.haUid ?? null)
        ctx.response.status(204).send('')
        return result
      },
      { isError: (r) => !r.ok, action: 'shopping_list.delete_item' },
    )
  }
}
