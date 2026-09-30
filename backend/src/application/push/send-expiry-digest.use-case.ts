import type { UseCase } from '#application/shared/use-case'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { PushSender, PushMessage } from '#domain/push/interfaces/push-sender.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { DigestTarget } from '#domain/push/push-token'
import type { ReminderSettingsRepository } from '#domain/push/reminder-settings'
import type { WebPushSender } from '#domain/push/interfaces/web-push-sender.interface'

const NAMES_SHOWN = 3

/**
 * One notification per device and per day, listing what expires within
 * the household's chosen window. Idempotent for a given `today`: a device already
 * served is skipped, so the scheduler may call it as often as it likes.
 */
export class SendExpiryDigest implements UseCase<{ today: string }, { sent: number }> {
  constructor(
    private readonly tokens: PushTokenRepository,
    private readonly products: ProductRepository,
    private readonly sender: PushSender,
    private readonly settings: ReminderSettingsRepository,
    private readonly webSender?: WebPushSender,
  ) {}

  async execute(input: { today: string }): Promise<{ sent: number }> {
    const due = await this.tokens.listDigestDue(input.today)
    if (due.length === 0) return { sent: 0 }

    const byHousehold = new Map<string, DigestTarget[]>()
    for (const target of due) {
      byHousehold.set(target.householdId, [...(byHousehold.get(target.householdId) ?? []), target])
    }

    let sent = 0
    const invalid: string[] = []
    for (const [householdId, targets] of byHousehold) {
      const days = await this.settings.getDays(householdId)
      const expiring = await this.products.findExpiringForDigest(householdId, input.today, days)
      const claimed = await this.tokens.claimDigest(targets, input.today)
      if (claimed.length === 0) continue
      if (expiring.length > 0) {
        const names = expiring.slice(0, NAMES_SHOWN).map((product) => product.name)
        const rest = expiring.length - names.length
        const messages: PushMessage[] = claimed.map(({ token }) => ({
          to: token,
          title:
            expiring.length === 1
              ? 'Un produit à sauver 🥕'
              : `${expiring.length} produits à sauver 🥕`,
          body:
            names.join(', ') +
            (rest > 0 ? ` et ${rest} autre${rest > 1 ? 's' : ''}` : '') +
            (expiring.length === 1
              ? ' approche de sa date. Une idée de repas ?'
              : ' approchent de leur date. À cuisiner bientôt !'),
          data: { route: '/fridge' },
        }))
        const native = messages.filter((_, index) => claimed[index]!.platform !== 'web')
        const web = messages.filter((_, index) => claimed[index]!.platform === 'web')
        const result = await this.sender.send(native)
        invalid.push(...result.invalidTokens)
        sent += native.length - result.invalidTokens.length
        if (this.webSender && web.length > 0) {
          const webResult = await this.webSender.send(
            web.map((message) => ({
              ...message,
              keys: claimed.find((target) => target.token === message.to)!.keys!,
            })),
          )
          invalid.push(...webResult.invalidTokens)
          sent += web.length - webResult.invalidTokens.length
        }
      }
    }
    if (invalid.length > 0) await this.tokens.deleteMany(invalid)
    return { sent }
  }
}
