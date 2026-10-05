import type { UseCase } from '#application/shared/use-case'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { PushSender, PushMessage } from '#domain/push/interfaces/push-sender.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { DigestTarget } from '#domain/push/push-token'
import type { ReminderSettingsRepository } from '#domain/push/reminder-settings'
import type { WebPushSender } from '#domain/push/interfaces/web-push-sender.interface'

const NAMES_SHOWN = 3

/**
 * Daily expiry summary and a weekly inventory check-up for each device.
 * Idempotent for a given `today`: a device already served is skipped, so the
 * scheduler may call it as often as it likes.
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
      const preferences = await this.settings.getPreferences(householdId)
      const days = await this.settings.getDays(householdId)
      const expiring = preferences.enabled
        ? await this.products.findExpiringForDigest(householdId, input.today, days)
        : []
      const claimed = await this.tokens.claimDigest(targets, input.today)
      if (claimed.length === 0) continue
      const messages: PushMessage[] = []
      if (expiring.length > 0) {
        const names = expiring.slice(0, NAMES_SHOWN).map((product) => product.name)
        const rest = expiring.length - names.length
        messages.push(
          ...claimed.map(({ token }) => ({
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
          })),
        )
      }
      if (
        preferences.checkupEnabled &&
        new Date(`${input.today}T00:00:00Z`).getUTCDay() === preferences.checkupDay
      ) {
        messages.push(
          ...claimed.map(({ token }) => ({
            to: token,
            title: 'Check-up du garde-manger',
            body: 'Quelques minutes pour mettre à jour les quantités et retirer les produits consommés : ton inventaire reste à jour !',
            data: { route: '/fridge' },
          })),
        )
      }
      if (messages.length > 0) {
        const byToken = new Map(claimed.map((target) => [target.token, target]))
        const native = messages.filter((message) => byToken.get(message.to)!.platform !== 'web')
        const web = messages.filter((message) => byToken.get(message.to)!.platform === 'web')
        const result = await this.sender.send(native)
        invalid.push(...result.invalidTokens)
        sent += native.filter((message) => !result.invalidTokens.includes(message.to)).length
        if (this.webSender && web.length > 0) {
          const webResult = await this.webSender.send(
            web.map((message) => ({
              ...message,
              keys: byToken.get(message.to)!.keys!,
            })),
          )
          invalid.push(...webResult.invalidTokens)
          sent += web.filter((message) => !webResult.invalidTokens.includes(message.to)).length
        }
      }
    }
    if (invalid.length > 0) await this.tokens.deleteMany(invalid)
    return { sent }
  }
}
