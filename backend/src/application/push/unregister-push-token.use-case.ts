import type { UseCase } from '#application/shared/use-case'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'

export class UnregisterPushToken implements UseCase<{ userId: string; token: string }, void> {
  constructor(private readonly tokens: PushTokenRepository) {}

  async execute(input: { userId: string; token: string }): Promise<void> {
    await this.tokens.deleteForUser(input.userId, input.token)
  }
}
