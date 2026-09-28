import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import { passkeyClient } from '@better-auth/passkey/client'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { getServerUrl, onServerUrlChange } from '../../application/shared/server-config.js'
import { nativePasskeysAvailable } from '../../application/shared/native-passkeys.js'

function availablePasskeyClient(): ReturnType<typeof passkeyClient> {
  if (Platform.OS !== 'web' && nativePasskeysAvailable()) {
    // Expo Go and older builds lack this native module. Requiring the bridge
    // only after checking avoids crashing the root layout on app startup.
    const { expoPasskeyClient } = require('expo-better-auth-passkey') as typeof import('expo-better-auth-passkey')
    return expoPasskeyClient() as ReturnType<typeof passkeyClient>
  }
  return passkeyClient()
}

function buildClient() {
  return createAuthClient({
    baseURL: getServerUrl(),
    plugins: [
      expoClient({
        scheme: 'gardemanger',
        storage: SecureStore,
        storagePrefix: 'gardemanger',
      }),
      availablePasskeyClient(),
    ],
  })
}

let client = buildClient()
// better-auth bakes `baseURL` into the client at creation, so changing
// server (Réglages > Changer de serveur) rebuilds it from scratch — this
// proxy is what lets every existing `authClient.foo()` call site keep
// working across that swap without threading a getter through all of them.
onServerUrlChange(() => {
  client = buildClient()
})

export const authClient = new Proxy({} as ReturnType<typeof buildClient>, {
  get(_target, prop) {
    return Reflect.get(client, prop)
  },
})
