import { render, screen } from '@testing-library/react-native'
import DeleteAccountRoute from '../../app/delete-account.js'

const mockSession = { isPending: false, isError: false, data: null as object | null | undefined }
jest.mock('../../application/identity/session.query.js', () => ({ useSessionQuery: () => mockSession }))
jest.mock('../identity/auth-entry-screen.js', () => ({
  AuthEntryScreen: ({ successHref }: { successHref: string }) => {
    const { Text } = require('react-native')
    return <Text testID="delete-account-sign-in">{successHref}</Text>
  },
}))
jest.mock('../shared/boot-splash.js', () => ({
  BootSplash: () => {
    const { Text } = require('react-native')
    return <Text>Chargement</Text>
  },
}))
jest.mock('../identity/delete-account-screen.js', () => ({
  DeleteAccountScreen: () => {
    const { Text } = require('react-native')
    return <Text>Suppression du compte</Text>
  },
}))

test('a signed-out web visitor can sign in and return to the deletion route', async () => {
  Object.assign(mockSession, { isPending: false, isError: false, data: null })
  await render(<DeleteAccountRoute />)
  expect(screen.getByTestId('delete-account-sign-in')).toHaveTextContent('/delete-account')
  expect(screen.queryByText('Suppression du compte')).toBeNull()
})

test('a signed-in visitor sees the deletion page', async () => {
  Object.assign(mockSession, { isPending: false, isError: false, data: {} })
  await render(<DeleteAccountRoute />)
  expect(screen.getByText('Suppression du compte')).toBeTruthy()
})

test.each([
  { isPending: true, isError: false },
  { isPending: false, isError: true },
])('session restoration waits rather than offering sign-in prematurely: %j', async (state) => {
  Object.assign(mockSession, { ...state, data: undefined })
  await render(<DeleteAccountRoute />)
  expect(screen.getByText('Chargement')).toBeTruthy()
  expect(screen.queryByTestId('delete-account-sign-in')).toBeNull()
})
