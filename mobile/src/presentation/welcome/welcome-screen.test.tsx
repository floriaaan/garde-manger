import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { WelcomeScreen } from './welcome-screen.js'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, Redirect: () => null }))
jest.mock('./use-welcome-seen.js', () => ({ markWelcomeSeen: jest.fn(async () => {}) }))

async function renderWelcome(passwordOnly = false) {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getAuthMethods').mockResolvedValue([
    { id: 'password', enabled: true, label: 'E-mail' },
    ...(passwordOnly ? [] : [{ id: 'pocketid' as const, enabled: true, label: 'Continuer avec PocketID' }]),
  ])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(<ThemeProvider><QueryClientProvider client={client}><ConnectorProvider connector={connector}><WelcomeScreen /></ConnectorProvider></QueryClientProvider></ThemeProvider>)
  await waitFor(() => expect(screen.getByTestId('auth-tab-sign-in')).toBeTruthy())
  return { client }
}

test('welcome offers registration immediately, with no presentation or server gate', async () => {
  await renderWelcome()
  expect(screen.getByTestId('auth-method-email')).toBeTruthy()
  expect(screen.getByText('Continuer avec PocketID')).toBeTruthy()
  expect(screen.queryByTestId('welcome-continue')).toBeNull()
  await fireEvent.press(screen.getByTestId('auth-change-server'))
  expect(router.push).toHaveBeenCalledWith({ pathname: '/server-choice', params: { next: 'sign-up' } })
})

test('a password-only server opens the form directly', async () => {
  await renderWelcome(true)
  expect(screen.getByTestId('signup-name')).toBeTruthy()
  expect(screen.queryByTestId('auth-method-email')).toBeNull()
})

test('switching methods or account intent preserves the registration draft', async () => {
  await renderWelcome()
  await fireEvent.press(screen.getByTestId('auth-method-email'))
  await fireEvent.changeText(screen.getByTestId('signup-name'), 'Alice')
  await fireEvent.changeText(screen.getByTestId('signup-email'), 'alice@example.com')
  await fireEvent.press(screen.getByTestId('auth-method-back'))
  await fireEvent.press(screen.getByTestId('auth-method-email'))
  expect(screen.getByTestId('signup-email').props.value).toBe('alice@example.com')
  await fireEvent.press(screen.getByTestId('auth-tab-sign-in'))
  expect(screen.queryByTestId('signup-email')).toBeNull()
  await fireEvent.press(screen.getByTestId('auth-tab-sign-up'))
  expect(screen.getByTestId('signup-name').props.value).toBe('Alice')
  expect(screen.getByTestId('signup-email').props.value).toBe('alice@example.com')
})

test('server and account-intent changes wait for pending authentication', async () => {
  const { client } = await renderWelcome()
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const mutation = client.getMutationCache().build(client, { mutationFn: () => pending })
  let execution!: Promise<void>
  await act(async () => { execution = mutation.execute(undefined) })
  await waitFor(() => expect(screen.getByTestId('auth-change-server')).toBeDisabled())
  expect(screen.getByTestId('auth-tab-sign-in')).toBeDisabled()
  const calls = jest.mocked(router.push).mock.calls.length
  await fireEvent.press(screen.getByTestId('auth-change-server'))
  expect(jest.mocked(router.push).mock.calls.length).toBe(calls)
  await act(async () => { finish(); await execution })
  await waitFor(() => expect(screen.getByTestId('auth-change-server')).not.toBeDisabled())
})
