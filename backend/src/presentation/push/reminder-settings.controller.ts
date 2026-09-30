import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { reminderSettingsValidator } from './reminder-settings.validator.js'

export default class ReminderSettingsController {
  async show(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const households = await ctx.containerResolver.make('identity.households')
    const household = await households.findByUserId(user.id)
    if (!household) return ctx.response.status(404).json({ type: 'no_household', message: 'Aucun foyer.' })
    const settings = await ctx.containerResolver.make('push.reminderSettings')
    const { default: env } = await import('#start/env')
    return ctx.response.json({ days: await settings.getDays(household.id),
      hour: env.get('PUSH_DIGEST_HOUR', 9), timeZone: env.get('PUSH_TIMEZONE', 'Europe/Paris') })
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const { days } = await ctx.request.validateUsing(reminderSettingsValidator)
    const households = await ctx.containerResolver.make('identity.households')
    const household = await households.findByUserId(user.id)
    if (!household) return ctx.response.status(404).json({ type: 'no_household', message: 'Aucun foyer.' })
    const settings = await ctx.containerResolver.make('push.reminderSettings')
    await settings.setDays(household.id, days)
    const { default: env } = await import('#start/env')
    return ctx.response.json({ days, hour: env.get('PUSH_DIGEST_HOUR', 9),
      timeZone: env.get('PUSH_TIMEZONE', 'Europe/Paris') })
  }
}
