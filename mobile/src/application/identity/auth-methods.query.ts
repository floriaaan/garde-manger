import { defineQuery } from '../shared/define-query.js'
import { platformCapabilities } from '../shared/platform-capabilities.js'

/** Filtered here so sign-in and account linking both drop Google where the platform can't offer it (ADR 0020). */
export const useAuthMethodsQuery = defineQuery(['auth-methods'], async (connector) => {
  const methods = await connector.getAuthMethods()
  return platformCapabilities.googleSignIn ? methods : methods.filter((method) => method.id !== 'google')
})
