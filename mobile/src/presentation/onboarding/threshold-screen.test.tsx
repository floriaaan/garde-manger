import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import * as Clipboard from 'expo-clipboard'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { configureTelemetry } from '../../application/shared/telemetry.js'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { showToast } from '../../application/shared/toast.js'
import { ThresholdScreen } from './threshold-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
}))

jest.mock('../../application/shared/toast.js', () => ({ showToast: jest.fn() }))
beforeEach(() => jest.mocked(showToast).mockClear())

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => true),
}))

jest.mock('expo-linking', () => ({ createURL: (path: string) => `gardemanger://${path}` }))

// The keychain has no implementation under jest, and entering a foyer writes
// to it (arming the dashboard's tour). Left unmocked, that write stays pending
// past the end of the test and the next render never commits.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

// `threshold-screen.tsx` reaches telemetry through `getTelemetry()` (the
// boundary lint forbids importing `infrastructure/telemetry` from
// presentation) — wiring the real singleton in here mirrors what
// `providers/wire-telemetry.ts` does for the app itself.
configureTelemetry(telemetry)

async function renderThreshold(overrides: { prefillCode?: string | null; intent?: 'create' | 'join' } = {}) {
  const connector = new FakeFridgeConnector()
  // Signing up is what leaves an account with no foyer — the state this whole
  // screen exists for, and the same path a real new account takes.
  await connector.signUpEmail('nouveau@exemple.com', 'motdepasse', 'Florian')
  const onEnteredHousehold = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ThresholdScreen
            userName="Florian"
            prefillCode={overrides.prefillCode ?? null}
            onEnteredHousehold={onEnteredHousehold}
            onScanCode={jest.fn()}
            onSignedOut={jest.fn()}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  // The first query is always awaited: this root commits asynchronously, so a
  // synchronous `getByTestId` right after `render` races the first paint.
  await waitFor(() => expect(screen.getByTestId('threshold-choose-create')).toBeTruthy())
  if (overrides.intent) await fireEvent.press(screen.getByTestId(`threshold-choose-${overrides.intent}`))
  return { connector, queryClient, onEnteredHousehold }
}

test('a clipboard read failure records telemetry and shows the empty-clipboard hint', async () => {
  ;(Clipboard.getStringAsync as jest.Mock).mockRejectedValueOnce(new Error('clipboard unavailable'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await renderThreshold({ intent: 'join' })
  await fireEvent.press(screen.getByTestId('threshold-paste'))

  await waitFor(() =>
    expect(spy).toHaveBeenCalledWith(
      'clipboard read failed',
      expect.objectContaining({ attributes: { 'app.operation': 'identity.paste_invite' } }),
    ),
  )
  spy.mockRestore()
})

test('pasting an invitation acknowledges receipt without announcing household access', async () => {
  jest.mocked(Clipboard.getStringAsync).mockResolvedValueOnce('K4Q2M7XP')
  const { onEnteredHousehold } = await renderThreshold({ intent: 'join' })
  await fireEvent.press(screen.getByTestId('threshold-paste'))
  await waitFor(() => expect(screen.getByTestId('threshold-invite-code').props.value).toBe('K4Q2M7XP'))
  expect(screen.getByText('Code collé')).toBeTruthy()
  expect(onEnteredHousehold).not.toHaveBeenCalled()
  expect(showToast).not.toHaveBeenCalled()
})

test('choosing an intent reveals only its form, without leaving the screen', async () => {
  await renderThreshold()
  expect(screen.getByTestId('threshold-household-name')).toBeTruthy()
  expect(screen.queryByTestId('threshold-invite-code')).toBeNull()
  await fireEvent.press(screen.getByTestId('threshold-choose-join'))
  expect(screen.getByTestId('threshold-invite-code')).toBeTruthy()
  expect(screen.queryByTestId('threshold-household-name')).toBeNull()
})

test('neither action is answerable until its field is', async () => {
  await renderThreshold()

  expect(screen.getByTestId('threshold-create-submit')).toBeDisabled()
  await fireEvent.press(screen.getByTestId('threshold-choose-join'))
  expect(screen.getByTestId('threshold-join-submit')).toBeDisabled()
})

test('naming a foyer creates it and hands the account over to the gate', async () => {
  const { connector, queryClient, onEnteredHousehold } = await renderThreshold()
  const createSpy = jest.spyOn(connector, 'createHousehold')

  await fireEvent.changeText(screen.getByTestId('threshold-household-name'), 'Coloc du 3e')
  await waitFor(() => expect(screen.getByTestId('threshold-create-submit')).not.toBeDisabled())
  await fireEvent.press(screen.getByTestId('threshold-create-submit'))

  await waitFor(() => expect(createSpy).toHaveBeenCalledWith('Coloc du 3e'))
  await waitFor(() => expect(onEnteredHousehold).toHaveBeenCalled())
  expect(queryClient.getQueryData(['household'])).toMatchObject({ name: 'Coloc du 3e' })
  expect(showToast).toHaveBeenCalledWith('Bienvenue dans Coloc du 3e.', 'success')
})

test('a code arriving whole from a deep link fills the field and arms the button', async () => {
  await renderThreshold({ prefillCode: 'K4Q2M7XP' })

  await waitFor(() => expect(screen.getByTestId('threshold-invite-code').props.value).toBe('K4Q2M7XP'))
  expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled()
})

test('a lowercase code typed one-handed is the same code', async () => {
  await renderThreshold({ intent: 'join' })

  await fireEvent.changeText(screen.getByTestId('threshold-invite-code'), 'k4q2m7xp')

  await waitFor(() => expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled())
})

test('joining with the real code enters the foyer', async () => {
  const { connector, queryClient, onEnteredHousehold } = await renderThreshold({ intent: 'join' })
  const joinSpy = jest.spyOn(connector, 'joinHousehold')

  await fireEvent.changeText(screen.getByTestId('threshold-invite-code'), 'K4Q2M7XP')
  await waitFor(() => expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled())
  await fireEvent.press(screen.getByTestId('threshold-join-submit'))

  await waitFor(() => expect(joinSpy).toHaveBeenCalledWith('K4Q2M7XP'))
  await waitFor(() => expect(onEnteredHousehold).toHaveBeenCalled())
  expect(queryClient.getQueryData(['household'])).toMatchObject({ role: 'member' })
})

test('the mandatory step is not a trap — there is always a way back to sign-in', async () => {
  await renderThreshold()

  expect(screen.getByTestId('threshold-sign-out')).toBeTruthy()
})

test('the first-run tour is opt-in and a skipped tour is cleared', async () => {
  jest.mocked(SecureStore.deleteItemAsync).mockClear()
  const { onEnteredHousehold } = await renderThreshold()
  expect(screen.getByTestId('threshold-tour').props.value).toBe(false)
  await fireEvent.changeText(screen.getByTestId('threshold-household-name'), 'Chez nous')
  await fireEvent.press(screen.getByTestId('threshold-create-submit'))
  await waitFor(() => expect(onEnteredHousehold).toHaveBeenCalled())
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('garde-manger.first-run-tour.armed')
})

// Last on purpose: this is the only case that leaves a settled failed mutation
// behind, and under this jest/React setup the next `render` in the file then
// never commits. A harness ordering fragility, not a product one — the same
// assertions pass in any position when they run first.
test('a rejected code is said on the field, and the foyer name is not lost with it', async () => {
  await renderThreshold()

  await fireEvent.changeText(screen.getByTestId('threshold-household-name'), 'Coloc du 3e')
  await fireEvent.press(screen.getByTestId('threshold-choose-join'))
  await fireEvent.changeText(screen.getByTestId('threshold-invite-code'), 'AAAA1111')
  await waitFor(() => expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled())
  await fireEvent.press(screen.getByTestId('threshold-join-submit'))

  // Matched without the apostrophe on purpose: the message is the server's own
  // (`error-serializer.ts`), and it uses a straight quote where this app's copy
  // uses a curly one.
  await waitFor(() => expect(screen.getByText(/invitation invalide/)).toBeTruthy())
  expect(showToast).not.toHaveBeenCalled()
  // The other branch is untouched: someone who mistyped a code has not
  // abandoned the name they were considering.
  await fireEvent.press(screen.getByTestId('threshold-choose-create'))
  expect(screen.getByTestId('threshold-household-name').props.value).toBe('Coloc du 3e')
})

