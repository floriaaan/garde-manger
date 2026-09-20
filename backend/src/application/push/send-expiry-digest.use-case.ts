import type { UseCase } from '#application/shared/use-case'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { PushSender, PushMessage } from '#domain/push/interfaces/push-sender.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { DigestTarget } from '#domain/push/push-token'

export const DIGEST_WINDOW_DAYS = 2
const NAMES_SHOWN = 3

/**
 * One notification per device and per day, listing what expires within
 * `DIGEST_WINDOW_DAYS`. Idempotent for a given `today`: a device already
 * served is skipped, so the scheduler may call it as often as it likes.
 */
export class SendExpiryDigest implements UseCase<{ today: string }, { sent: number }> {
  constructor(
    private readonly tokens: PushTokenRepository,
    private readonly products: ProductRepository,
    private readonly sender: PushSender,
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
      const expiring = await this.products.findExpiringSoon(householdId, DIGEST_WINDOW_DAYS)
      if (expiring.length > 0) {
        const names = expiring.slice(0, NAMES_SHOWN).map((product) => product.name)
        const rest = expiring.length - names.length
        const messages: PushMessage[] = targets.map(({ token }) => ({
          to: token,
          title:
            expiring.length === 1
              ? '1 produit expire bientôt'
              : `${expiring.length} produits expirent bientôt`,
          body: names.join(', ') + (rest > 0 ? ` et ${rest} autre${rest > 1 ? 's' : ''}` : ''),
          data: { route: '/fridge' },
        }))
        const result = await this.sender.send(messages)
        invalid.push(...result.invalidTokens)
        sent += messages.length - result.invalidTokens.length
      }
      // Served even when there was nothing to say: no second look today.
      await this.tokens.markDigested(
        targets.map((target) => target.token),
        input.today,
      )
    }
    if (invalid.length > 0) await this.tokens.deleteMany(invalid)
    return { sent }
  }
}
