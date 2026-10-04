import { act, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Redirect, Tabs } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { BootSplash } from '../shared/boot-splash.js'
import { JobHost } from '../job/job-host.js'
import TabsLayout from '../../app/(tabs)/_layout.js'

jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
  Tabs: Object.assign(jest.fn(() => null), { Screen: jest.fn(() => null) }),
}))
jest.mock('expo-router/unstable-native-tabs', () => ({ NativeTabs: jest.fn(() => null) }))
jest.mock('../welcome/use-welcome-seen.js', () => ({ useHasSeenWelcome: () => true }))
jest.mock('../shared/app-shell.js', () => ({ USES_NATIVE_TABS: false }))
jest.mock('../shared/boot-splash.js', () => ({ BootSplash: jest.fn(() => null) }))
jest.mock('../job/job-host.js', () => ({ JobHost: jest.fn(() => null) }))
jest.mock('../job/active-job-pill.js', () => ({ ActiveJobPill: () => null }))
jest.mock('../push/push-host.js', () => ({ PushHost: () => null }))

beforeEach(() => jest.clearAllMocks())

test('an initial household error keeps the retry splash, then an empty retry opens onboarding', async () => {
  const connector = new FakeFridgeConnector()
  await connector.signUpEmail('new@example.com', 'password', 'Florian')
  const householdRead = jest.spyOn(connector, 'getHousehold').mockRejectedValue(new Error('offline'))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}><TabsLayout /></ConnectorProvider>
    </QueryClientProvider>,
  )

  await waitFor(() => expect(queryClient.getQueryState(['household'])?.status).toBe('error'))
  await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'))
  expect(BootSplash).toHaveBeenCalled()
  expect(Tabs).not.toHaveBeenCalled()
  expect(JobHost).not.toHaveBeenCalled()
  expect(Redirect).not.toHaveBeenCalled()

  householdRead.mockResolvedValue(null)
  await act(async () => { await queryClient.invalidateQueries({ queryKey: ['household'] }) })
  await waitFor(() => expect(jest.mocked(Redirect).mock.calls.some(([props]) => props.href === '/(onboarding)')).toBe(true))
  expect(Tabs).not.toHaveBeenCalled()

  await act(async () => { queryClient.setQueryData(['household'], fakeHousehold) })
  await waitFor(() => expect(Tabs).toHaveBeenCalled())
  expect(JobHost).toHaveBeenCalled()
})
