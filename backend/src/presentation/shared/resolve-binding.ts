import type { HttpContext } from '@adonisjs/core/http'
import type { ContainerBindings } from '@adonisjs/core/types'

/** Keep provider types at the HTTP boundary: Adonis exposes this resolver as ContainerResolver<any>. */
export function resolveBinding<K extends keyof ContainerBindings>(
  ctx: Pick<HttpContext, 'containerResolver'>,
  binding: K,
): Promise<ContainerBindings[K]> {
  return ctx.containerResolver.make(binding)
}
