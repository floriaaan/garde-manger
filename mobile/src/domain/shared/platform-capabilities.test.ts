import { capabilitiesFor } from './platform-capabilities.js'

test('iOS never offers the Stripe subscription', () => {
  expect(capabilitiesFor('ios')).toEqual({ billing: false })
})

test.each(['android', 'web'])('%s keeps it', (os) => {
  expect(capabilitiesFor(os)).toEqual({ billing: true })
})
