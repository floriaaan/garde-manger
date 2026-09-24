import env from '#start/env'
import { AuthMethod } from '#domain/identity/auth-method.vo'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'

export class EnvAuthMethodsProvider implements AuthMethodsProvider {
  async resolve(): Promise<AuthMethod[]> {
    const methods: AuthMethod[] = []

    if (!env.get('DISABLE_PASSWORD_LOGIN', false)) {
      methods.push(
        AuthMethod.create({ id: 'password', enabled: true, label: 'Email et mot de passe' }),
      )
    }

    const pocketIdConfigured =
      Boolean(env.get('POCKETID_CLIENT_ID', '')) &&
      Boolean(env.get('POCKETID_CLIENT_SECRET', '')) &&
      Boolean(env.get('POCKETID_ISSUER_URL', ''))

    if (pocketIdConfigured) {
      methods.push(AuthMethod.create({ id: 'pocketid', enabled: true, label: 'PocketID' }))
    }

    const googleConfigured =
      Boolean(env.get('GOOGLE_CLIENT_ID', '')) && Boolean(env.get('GOOGLE_CLIENT_SECRET', ''))

    if (googleConfigured) {
      methods.push(AuthMethod.create({ id: 'google', enabled: true, label: 'Google' }))
    }

    const appleConfigured =
      Boolean(env.get('APPLE_CLIENT_ID', '')) &&
      Boolean(env.get('APPLE_TEAM_ID', '')) &&
      Boolean(env.get('APPLE_KEY_ID', '')) &&
      Boolean(env.get('APPLE_PRIVATE_KEY', ''))

    if (appleConfigured) {
      methods.push(AuthMethod.create({ id: 'apple', enabled: true, label: 'Apple' }))
    }

    // Passkeys are a WebAuthn/device capability, not a server credential to
    // configure — always offered, same as the passkey plugin itself always
    // being registered in instance.ts.
    methods.push(AuthMethod.create({ id: 'passkey', enabled: true, label: 'Clé d’accès' }))

    return methods
  }
}
