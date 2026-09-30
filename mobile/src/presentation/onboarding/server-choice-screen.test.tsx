import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ServerChoiceScreen } from './server-choice-screen.js'
import { clearServerUrl, getServerUrl, OFFICIAL_SERVER_URL, setServerUrl } from '../../application/shared/server-config.js'

function renderWithProviders(children: ReactNode) {
  const connector = new FakeFridgeConnector()
  return render(
    <ThemeProvider>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </ThemeProvider>,
  )
}

async function chooseSelfHosted() {
  if (!screen.queryByTestId('server-choice-self-hosted')) {
    await fireEvent.press(screen.getByTestId('server-choice-advanced'))
  }
  await fireEvent.press(screen.getByTestId('server-choice-self-hosted'))
}

test('the official instance is immediately usable while advanced options stay closed', async () => {
  const onDone = jest.fn()
  await renderWithProviders(<ServerChoiceScreen onDone={onDone} />)

  expect(screen.getByTestId('server-choice-advanced').props.accessibilityState).toEqual({ expanded: false })
  expect(screen.queryByTestId('server-choice-self-hosted')).toBeNull()
  expect(screen.getByTestId('server-choice-official').props.accessibilityState.selected).toBe(true)

  await fireEvent.press(screen.getByTestId('server-choice-submit'))
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  expect(getServerUrl()).toBe(OFFICIAL_SERVER_URL)
  expect(screen.getByTestId('server-choice-advanced').props.accessibilityRole).toBe('button')
})

test('a recognized server shows what was found, then confirming calls onDone', async () => {
  const onDone = jest.fn()
  await renderWithProviders(<ServerChoiceScreen onDone={onDone} />)

  await chooseSelfHosted()
  await fireEvent.changeText(screen.getByTestId('server-choice-url'), 'https://valid.example.com')
  await fireEvent.press(screen.getByTestId('server-choice-submit'))

  await waitFor(() => expect(screen.getByTestId('server-choice-found')).toBeTruthy())
  expect(screen.getByText('Garde-manger de test — v0.0.0')).toBeTruthy()

  await fireEvent.press(screen.getByTestId('server-choice-submit'))
  expect(onDone).toHaveBeenCalledTimes(1)
})

test('an address with no protocol is rejected before any network call', async () => {
  const onDone = jest.fn()
  await renderWithProviders(<ServerChoiceScreen onDone={onDone} />)

  await chooseSelfHosted()
  await fireEvent.changeText(screen.getByTestId('server-choice-url'), 'mon-serveur.exemple.com')
  await fireEvent.press(screen.getByTestId('server-choice-submit'))

  await waitFor(() =>
    expect(screen.getByText('Adresse invalide : il manque le https:// (ex. https://mon-serveur.exemple.com).')).toBeTruthy(),
  )
  expect(onDone).not.toHaveBeenCalled()
})

test('a server that does not answer like Garde-manger is rejected with a clear message', async () => {
  const onDone = jest.fn()
  await renderWithProviders(<ServerChoiceScreen onDone={onDone} />)

  await chooseSelfHosted()
  await fireEvent.changeText(screen.getByTestId('server-choice-url'), 'https://not-a-garde-manger.example.com')
  await fireEvent.press(screen.getByTestId('server-choice-submit'))

  await waitFor(() =>
    expect(screen.getByText("Ce serveur ne répond pas comme une instance Garde-manger. Vérifie l'adresse.")).toBeTruthy(),
  )
  expect(screen.getByText('Vérifier')).toBeTruthy()
  expect(onDone).not.toHaveBeenCalled()
})

test('closing and reopening advanced options keeps the typed address', async () => {
  await renderWithProviders(<ServerChoiceScreen onDone={jest.fn()} />)
  await chooseSelfHosted()
  await fireEvent.changeText(screen.getByTestId('server-choice-url'), 'https://mon-serveur.example.com')

  await fireEvent.press(screen.getByTestId('server-choice-advanced'))
  expect(screen.getByTestId('server-choice-advanced').props.accessibilityState).toEqual({ expanded: false })
  expect(screen.queryByTestId('server-choice-url')).toBeNull()
  expect(screen.getByTestId('server-choice-official').props.accessibilityState.selected).toBe(true)

  await chooseSelfHosted()
  expect(screen.getByTestId('server-choice-url').props.value).toBe('https://mon-serveur.example.com')
})

test('returning to onboarding shows an already chosen self-hosted instance', async () => {
  await setServerUrl('https://saved.example.com')
  try {
    await renderWithProviders(<ServerChoiceScreen onDone={jest.fn()} />)
    expect(screen.getByTestId('server-choice-advanced').props.accessibilityState).toEqual({ expanded: true })
    expect(screen.getByTestId('server-choice-self-hosted').props.accessibilityState.selected).toBe(true)
    expect(screen.getByTestId('server-choice-url').props.value).toBe('https://saved.example.com')
  } finally {
    await clearServerUrl()
  }
})
