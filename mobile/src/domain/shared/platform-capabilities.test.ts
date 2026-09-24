import { capabilitiesFor } from './platform-capabilities.js'

test('iOS offers neither the Stripe subscription nor Google sign-in', () => {
  expect(capabilitiesFor('ios')).toEqual({ billing: false, googleSignIn: false })
})

test.each(['android', 'web'])('%s keeps both', (os) => {
  expect(capabilitiesFor(os)).toEqual({ billing: true, googleSignIn: true })
})
