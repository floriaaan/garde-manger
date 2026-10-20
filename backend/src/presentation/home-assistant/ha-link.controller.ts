import { resolveBinding } from '#presentation/shared/resolve-binding'
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  saveHomeAssistantConnectionValidator,
  discoverTodoEntitiesValidator,
  bindHomeAssistantListValidator,
} from './ha-link.validator.js'
import { toHomeAssistantLinkDto } from './ha-link.dto.js'
import { GetHomeAssistantLink } from '#application/home-assistant/get-home-assistant-link.use-case'
import { SaveHomeAssistantConnection } from '#application/home-assistant/save-home-assistant-connection.use-case'
import { DiscoverTodoEntities } from '#application/home-assistant/discover-todo-entities.use-case'
import { BindHomeAssistantList } from '#application/home-assistant/bind-home-assistant-list.use-case'
import { UnlinkHomeAssistant } from '#application/home-assistant/unlink-home-assistant.use-case'
import { SyncShoppingList } from '#application/home-assistant/sync-shopping-list.use-case'

export default class HaLinkController {
  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'home_assistant',
      GetHomeAssistantLink,
      async () => {
        const getHomeAssistantLink = await resolveBinding(ctx, 'homeAssistant.getHomeAssistantLink')
        const result = await getHomeAssistantLink.execute({
          householdId: ctx.household.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json(toHomeAssistantLinkDto(result.value))
        return result
      },
      { isError: (r) => !r.ok, action: 'home_assistant.get_link' },
    )
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'home_assistant',
      SaveHomeAssistantConnection,
      async () => {
        const payload = await ctx.request.validateUsing(saveHomeAssistantConnectionValidator)

        const saveHomeAssistantConnection = await resolveBinding(
          ctx,
          'homeAssistant.saveHomeAssistantConnection',
        )
        const result = await saveHomeAssistantConnection.execute({
          userId: user.id,
          householdId: ctx.household.id,
          instanceUrl: payload.instanceUrl,
          token: payload.token ?? '',
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json(toHomeAssistantLinkDto(result.value))
        return result
      },
      { isError: (r) => !r.ok, action: 'home_assistant.save_connection' },
    )
  }

  async discover(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'home_assistant',
      DiscoverTodoEntities,
      async () => {
        const payload = await ctx.request.validateUsing(discoverTodoEntitiesValidator)

        const discoverTodoEntities = await resolveBinding(ctx, 'homeAssistant.discoverTodoEntities')
        const result = await discoverTodoEntities.execute({
          userId: user.id,
          householdId: ctx.household.id,
          instanceUrl: payload.instanceUrl,
          token: payload.token,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json({ entities: result.value })
        return result
      },
      { isError: (r) => !r.ok, action: 'home_assistant.discover' },
    )
  }

  async bind(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'home_assistant',
      BindHomeAssistantList,
      async () => {
        const payload = await ctx.request.validateUsing(bindHomeAssistantListValidator)

        const bindHomeAssistantList = await resolveBinding(
          ctx,
          'homeAssistant.bindHomeAssistantList',
        )
        const result = await bindHomeAssistantList.execute({
          userId: user.id,
          householdId: ctx.household.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json(toHomeAssistantLinkDto(result.value))
        return result
      },
      { isError: (r) => !r.ok, action: 'home_assistant.bind_list' },
    )
  }

  async destroy(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'home_assistant',
      UnlinkHomeAssistant,
      async () => {
        const unlinkHomeAssistant = await resolveBinding(ctx, 'homeAssistant.unlinkHomeAssistant')
        const result = await unlinkHomeAssistant.execute({
          userId: user.id,
          householdId: ctx.household.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(204).send('')
        return result
      },
      { isError: (r) => !r.ok, action: 'home_assistant.unlink' },
    )
  }

  async sync(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'home_assistant',
      SyncShoppingList,
      async () => {
        const syncShoppingList = await resolveBinding(ctx, 'homeAssistant.syncShoppingList')
        const result = await syncShoppingList.execute({
          householdId: ctx.household.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json(result.value)
        return result
      },
      { isError: (r) => !r.ok },
    )
  }
}
