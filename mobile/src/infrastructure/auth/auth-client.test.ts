jest.mock('better-auth/react', () => ({ createAuthClient: jest.fn(() => ({})) }))
jest.mock('@better-auth/expo/client', () => ({ expoClient: jest.fn(() => ({})) }))
jest.mock('@better-auth/passkey/client', () => ({ passkeyClient: jest.fn(() => ({})) }))
jest.mock('expo-secure-store', () => ({}))
jest.mock('../../application/shared/native-passkeys.js', () => ({ nativePasskeysAvailable: () => false }))
jest.mock('../../application/shared/server-config.js', () => ({
  getServerUrl: () => 'https://api.example.com', onServerUrlChange: jest.fn(),
}))
export {}

test.each(['ios', 'android', 'web'])('auth supplies an explicit origin only on native: %s', (os) => {
  jest.isolateModules(() => {
    const { Platform } = require('react-native')
    const originalOS = Platform.OS
    const { createAuthClient: create } = require('better-auth/react')
    create.mockClear()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
    try {
      require('./auth-client.js')
      const options = create.mock.calls[0][0]
      expect(options.fetchOptions).toEqual(os === 'web' ? undefined : { headers: { origin: 'gardemanger://' } })
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    }
  })
})
