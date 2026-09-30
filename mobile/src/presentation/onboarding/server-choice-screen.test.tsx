import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import * as serverConfig from '../../application/shared/server-config.js'
import { ServerChoiceScreen } from './server-choice-screen.js'

function renderWithProviders(children: ReactNode) {
  const connector = new FakeFridgeConnector()
  return render(
    <ThemeProvider>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </ThemeProvider>,
  )
}

test('a recognized server shows what was found, then confirming calls onDone', async () => {
  const onDone = jest.fn()
  await renderWithProviders(<ServerChoiceScreen onDone={onDone} />)

  await fireEvent.press(screen.getByTestId('server-choice-self-hosted'))
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

  await fireEvent.press(screen.getByTestId('server-choice-self-hosted'))
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

  await fireEvent.press(screen.getByTestId('server-choice-self-hosted'))
  await fireEvent.changeText(screen.getByTestId('server-choice-url'), 'https://not-a-garde-manger.example.com')
  await fireEvent.press(screen.getByTestId('server-choice-submit'))

  await waitFor(() =>
    expect(screen.getByText("Ce serveur ne répond pas comme une instance Garde-manger. Vérifie l'adresse.")).toBeTruthy(),
  )
  expect(screen.getByText('Vérifier')).toBeTruthy()
  expect(onDone).not.toHaveBeenCalled()
})

test('confirming the active official server preserves the auth query cache', async () => {
  const current = jest.spyOn(serverConfig, 'getServerUrl').mockReturnValue(serverConfig.OFFICIAL_SERVER_URL)
  const save = jest.spyOn(serverConfig, 'setServerUrl')
  const onDone = jest.fn()
  await renderWithProviders(<ServerChoiceScreen onDone={onDone} />)
  await fireEvent.press(screen.getByTestId('server-choice-submit'))
  expect(save).not.toHaveBeenCalled()
  expect(onDone).toHaveBeenCalledTimes(1)
  current.mockRestore()
  save.mockRestore()
})
