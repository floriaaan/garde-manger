import type { UseCase } from '#application/shared/use-case'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { PushPlatform } from '#domain/push/push-token'
import type { IdGenerator } from '#domain/shared/id-generator.interface'

export class RegisterPushToken implements UseCase<
  { userId: string; token: string; platform: PushPlatform },
  void
> {
  constructor(
    private readonly tokens: PushTokenRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: { userId: string; token: string; platform: PushPlatform }): Promise<void> {
    await this.tokens.upsert({ id: this.idGenerator.next(), ...input })
  }
}
