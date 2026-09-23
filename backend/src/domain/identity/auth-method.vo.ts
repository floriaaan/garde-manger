import { ValueObject } from '#domain/shared/value-object'

export type AuthMethodId = 'password' | 'pocketid' | 'google' | 'apple' | 'passkey'

interface AuthMethodProps {
  id: AuthMethodId
  enabled: boolean
  label: string
}

export class AuthMethod extends ValueObject<AuthMethodProps> {
  private constructor(props: AuthMethodProps) {
    super(props)
  }

  static create(props: AuthMethodProps): AuthMethod {
    return new AuthMethod(props)
  }

  get id(): AuthMethodId {
    return this.props.id
  }

  get enabled(): boolean {
    return this.props.enabled
  }

  get label(): string {
    return this.props.label
  }
}
