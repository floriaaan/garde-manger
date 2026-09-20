import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ServerInfoScreen } from './server-info-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

async function renderScreen(connector = new FakeFridgeConnector()) {
  await connector.signInSocial()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ServerInfoScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

test('verifying then saving signs out, clears the cache, and lands on sign-in', async () => {
  const connector = await renderScreen()

  await fireEvent.changeText(screen.getByTestId('server-choice-url'), 'https://valid.example.com')
  await fireEvent.press(screen.getByTestId('server-choice-submit'))

  await waitFor(() => expect(screen.getByTestId('server-choice-found')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('server-choice-submit'))

  await waitFor(async () => expect(await connector.getSession()).toBeNull())
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-in'))
})

test('a server that does not answer like Garde-manger is rejected, never saved', async () => {
  await renderScreen()

  await fireEvent.changeText(screen.getByTestId('server-choice-url'), 'https://not-a-garde-manger.example.com')
  await fireEvent.press(screen.getByTestId('server-choice-submit'))

  await waitFor(() =>
    expect(screen.getByText("Ce serveur ne répond pas comme une instance Garde-manger. Vérifie l'adresse.")).toBeTruthy(),
  )
  expect(router.replace).not.toHaveBeenCalled()
})
