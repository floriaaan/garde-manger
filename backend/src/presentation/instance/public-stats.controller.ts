import { resolveBinding } from '#presentation/shared/resolve-binding'
import type { HttpContext } from '@adonisjs/core/http'
import { GetPublicStats } from '#application/instance/get-public-stats.use-case'
import { traceAction } from '#presentation/shared/trace-action'

export default class PublicStatsController {
  async show(ctx: HttpContext) {
    return traceAction(ctx, 'instance', GetPublicStats, async () => {
      const useCase = await resolveBinding(ctx, 'instance.getPublicStats')
      const stats = await useCase.execute()

      // 404 rather than 403: a disabled endpoint is indistinguishable from an
      // absent one, which is exactly what an instance that opted out wants.
      if (!stats) return ctx.response.status(404).json({ error: { type: 'not_found' } })

      // Unauthenticated and backed by count(*): let browsers and any reverse
      // proxy absorb repeat visits instead of the database.
      ctx.response.header('Cache-Control', 'public, max-age=300')
      ctx.response.json({ stats })
    })
  }
}
