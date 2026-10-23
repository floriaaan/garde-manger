import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Linking } from 'react-native'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FeedbackScreen } from './feedback-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useFocusEffect: jest.fn() }))

afterEach(() => jest.restoreAllMocks())

function renderFeedback() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<ThemeProvider><QueryClientProvider client={queryClient}>
    <ConnectorProvider connector={new FakeFridgeConnector()}><FeedbackScreen /></ConnectorProvider>
  </QueryClientProvider></ThemeProvider>)
}

test('opens a free-form email without personal data or claiming it was sent', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  renderFeedback()
  expect(screen.getByText(/Aucune donnée de ton compte/)).toBeTruthy()
  expect(screen.getByText(/Ton adresse e-mail sera visible/)).toBeTruthy()
  expect(screen.getByText(/Par exemple : une fonction qui te manque/)).toBeTruthy()
  expect(openURL).not.toHaveBeenCalled()
  fireEvent.press(screen.getByRole('button', { name: 'Préparer mon e-mail' }))
  await waitFor(() => expect(screen.getByText(/Ton retour n’est pas envoyé/)).toBeTruthy())

  const url = new URL(openURL.mock.calls[0][0])
  expect(url.protocol).toBe('mailto:')
  expect(url.pathname).toBe('garde-manger@floriaaan.fr')
  expect([...url.searchParams.keys()]).toEqual(['subject', 'body'])
  expect(url.searchParams.get('subject')).toBe('Retour produit — Garde-manger')
  expect(url.searchParams.get('body')).toBe('Bonjour,\n\nVoici mon retour sur Garde-manger :\n\n')
})

test.each(['rejection', 'unavailable'] as const)('offers a selectable address and a retry on %s', async (failure) => {
  const openURL = jest.spyOn(Linking, 'openURL')
  if (failure === 'rejection') openURL.mockRejectedValueOnce(new Error('No mail app'))
  else openURL.mockResolvedValueOnce(false)
  openURL.mockResolvedValueOnce(true)
  renderFeedback()
  fireEvent.press(screen.getByTestId('feedback-open-email'))
  await waitFor(() => expect(screen.getByText(/Impossible d’ouvrir ta messagerie/)).toBeTruthy())
  expect(screen.getByTestId('feedback-email-address').props.selectable).toBe(true)
  expect(screen.getByText('garde-manger@floriaaan.fr')).toBeTruthy()

  fireEvent.press(screen.getByRole('button', { name: 'Réessayer d’ouvrir la messagerie' }))
  await waitFor(() => expect(screen.getByText(/Ton retour n’est pas envoyé/)).toBeTruthy())
  expect(screen.queryByText(/Impossible d’ouvrir ta messagerie/)).toBeNull()
})

test('disables the action while the email handoff is pending', async () => {
  let finish!: (value: boolean) => void
  jest.spyOn(Linking, 'openURL').mockReturnValue(new Promise((resolve) => { finish = resolve }))
  renderFeedback()
  fireEvent.press(screen.getByTestId('feedback-open-email'))
  expect(screen.getByRole('button', { name: 'Ouverture de la messagerie…', disabled: true })).toBeTruthy()
  expect(screen.getByTestId('feedback-open-email').props.accessibilityState).toEqual({ disabled: true, busy: true })
  await act(async () => { finish(true) })
  await waitFor(() => expect(screen.getByTestId('feedback-open-email').props.accessibilityState.disabled).toBe(false))
})
