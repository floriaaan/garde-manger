import { render, screen } from '@testing-library/react-native'
import SubscriptionRoute from '../../app/subscription.js'

const mockSession = { isPending: false, isError: false, data: null as object | null | undefined }
jest.mock('../../application/identity/session.query.js', () => ({ useSessionQuery: () => mockSession }))
jest.mock('../identity/auth-entry-screen.js', () => ({
  AuthEntryScreen: ({ successHref }: { successHref: string }) => {
    const { Text } = require('react-native')
    return <Text testID="subscription-sign-in">{successHref}</Text>
  },
}))
jest.mock('../shared/boot-splash.js', () => ({
  BootSplash: () => {
    const { Text } = require('react-native')
    return <Text>Chargement</Text>
  },
}))
jest.mock('./subscription-screen.js', () => ({
  SubscriptionScreen: () => {
    const { Text } = require('react-native')
    return <Text>Abonnement</Text>
  },
}))

test('a signed-out web visitor can sign in and return to the subscription route', async () => {
  Object.assign(mockSession, { isPending: false, isError: false, data: null })
  await render(<SubscriptionRoute />)
  expect(screen.getByTestId('subscription-sign-in')).toHaveTextContent('/subscription')
  expect(screen.queryByText('Abonnement')).toBeNull()
})

test('a signed-in visitor sees the subscription page', async () => {
  Object.assign(mockSession, { isPending: false, isError: false, data: {} })
  await render(<SubscriptionRoute />)
  expect(screen.getByText('Abonnement')).toBeTruthy()
})

test.each([
  { isPending: true, isError: false },
  { isPending: false, isError: true },
])('session restoration waits rather than offering sign-in prematurely: %j', async (state) => {
  Object.assign(mockSession, { ...state, data: undefined })
  await render(<SubscriptionRoute />)
  expect(screen.getByText('Chargement')).toBeTruthy()
  expect(screen.queryByTestId('subscription-sign-in')).toBeNull()
})
