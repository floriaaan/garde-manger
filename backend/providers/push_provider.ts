import type { ApplicationService } from '@adonisjs/core/types'
import type { PushSender } from '#domain/push/interfaces/push-sender.interface'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { PushScheduler } from '#infrastructure/push/push-scheduler'
import type { ReminderSettingsRepository } from '#domain/push/reminder-settings'
import type { WebPushSender } from '#domain/push/interfaces/web-push-sender.interface'

/**
 * Push notifications (cf. docs/adr/0018): token storage, the Expo sender and,
 * in the web process only, the daily expiry-digest scheduler.
 */
export default class PushProvider {
  private scheduler: PushScheduler | null = null

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('push.reminderSettings', async () => {
      const { LucidReminderSettingsRepository } =
        await import('#infrastructure/database/push/reminder-settings.repository')
      return new LucidReminderSettingsRepository()
    })
    this.app.container.singleton('push.tokens', async () => {
      const { LucidPushTokenRepository } =
        await import('#infrastructure/database/push/push-token.repository')
      return new LucidPushTokenRepository()
    })

    this.app.container.singleton('push.sender', async () => {
      const { default: env } = await import('#start/env')
      const logger = await this.app.container.make('logger')
      const onError = (error: unknown, message: string) => logger.error({ err: error }, message)
      if (!env.get('PUSH_ENABLED', true)) {
        const { NoopPushSender } = await import('#infrastructure/push/noop-push-sender')
        return new NoopPushSender()
      }
      const { ExpoPushSender } = await import('#infrastructure/push/expo-push-sender')
      return new ExpoPushSender(env.get('EXPO_ACCESS_TOKEN'), onError)
    })

    this.app.container.singleton('push.webSender', async () => {
      const { default: env } = await import('#start/env')
      const subject = env.get('WEB_PUSH_VAPID_SUBJECT')
      const publicKey = env.get('WEB_PUSH_VAPID_PUBLIC_KEY')
      const privateKey = env.get('WEB_PUSH_VAPID_PRIVATE_KEY')
      if (!subject || !publicKey || !privateKey) return null
      const { VapidWebPushSender } = await import('#infrastructure/push/web-push-sender')
      const logger = await this.app.container.make('logger')
      return new VapidWebPushSender({ subject, publicKey, privateKey }, (error, message) =>
        logger.error({ err: error }, message),
      )
    })
  }

  async ready() {
    if (this.app.getEnvironment() !== 'web') return
    const { default: env } = await import('#start/env')
    if (!env.get('PUSH_ENABLED', true)) return

    const container = this.app.container
    const [tokens, sender, products, clock, logger, settings, webSender] = await Promise.all([
      container.make('push.tokens'),
      container.make('push.sender'),
      container.make('fridge.products'),
      container.make('shared.clock'),
      container.make('logger'),
      container.make('push.reminderSettings'),
      container.make('push.webSender'),
    ])
    const { SendExpiryDigest } = await import('#application/push/send-expiry-digest.use-case')
    const { PushScheduler } = await import('#infrastructure/push/push-scheduler')

    const digest = new SendExpiryDigest(tokens, products, sender, settings, webSender ?? undefined)
    this.scheduler = new PushScheduler({
      digest: (today) => digest.execute({ today }),
      hour: env.get('PUSH_DIGEST_HOUR', 9),
      timeZone: env.get('PUSH_TIMEZONE', 'Europe/Paris'),
      now: () => clock.now(),
      onError: (error, message) => logger.error({ err: error }, message),
    })
    this.scheduler.start()
  }

  async shutdown() {
    this.scheduler?.stop()
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'push.tokens': PushTokenRepository
    'push.sender': PushSender
    'push.reminderSettings': ReminderSettingsRepository
    'push.webSender': WebPushSender | null
  }
}
