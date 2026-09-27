import { defineQuery } from '../shared/define-query.js'
import { platformCapabilities } from '../shared/platform-capabilities.js'
import { Platform } from 'react-native'
import { getServerUrl, OFFICIAL_SERVER_URL } from '../shared/server-config.js'
import { nativePasskeysAvailable } from '../shared/native-passkeys.js'
import { isFakeConnector } from '../shared/connector-mode.js'

/** Match the offered methods to native capabilities and the selected server. */
export const useAuthMethodsQuery = defineQuery(['auth-methods'], async (connector) => {
  const methods = await connector.getAuthMethods()
  const appleEnabled = methods.some((method) => method.id === 'apple' && method.enabled)
  return methods.filter((method) => {
    if (method.id === 'google') return platformCapabilities.googleSignIn || (Platform.OS === 'ios' && appleEnabled)
    if (method.id === 'apple') return isFakeConnector || Platform.OS === 'ios'
    if (method.id === 'passkey' && Platform.OS !== 'web') {
      return isFakeConnector || (nativePasskeysAvailable() && getServerUrl().replace(/\/+$/, '') === OFFICIAL_SERVER_URL)
    }
    return true
  })
})
