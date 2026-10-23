import { capabilitiesFor } from './platform-capabilities.js'

test('iOS disables direct Stripe billing and Google sign-in by default', () => {
  expect(capabilitiesFor('ios')).toEqual({ billing: false, storeKit: true, googleSignIn: false })
})

test.each(['android', 'web'])('%s keeps both', (os) => {
  expect(capabilitiesFor(os)).toEqual({ billing: true, storeKit: false, googleSignIn: true })
})
