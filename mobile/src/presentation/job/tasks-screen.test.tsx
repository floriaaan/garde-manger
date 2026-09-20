import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { TasksScreen } from './tasks-screen.js'
import { makeJob, renderWithJobs } from './test-utils.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  usePathname: jest.fn(() => '/tasks'),
  useFocusEffect: jest.fn(),
}))

beforeEach(() => jest.clearAllMocks())

test('says so when there is nothing to show', async () => {
  await renderWithJobs(<TasksScreen />, [])

  await waitFor(() => expect(screen.getByText('Aucune analyse en cours.')).toBeTruthy())
})

test('a running job shows its progress and offers no action, only waiting', async () => {
  await renderWithJobs(<TasksScreen />, [makeJob({ kind: 'fridge_scan', progress: { total: 5, done: 2, failed: [] } })])

  await waitFor(() => expect(screen.getByTestId('task-job-1-bar')).toBeTruthy())
  expect(screen.getByText('Photo 3 sur 5')).toBeTruthy()
  expect(screen.queryByTestId('task-job-1-action')).toBeNull()
  expect(screen.queryByTestId('task-job-1-dismiss')).toBeNull()
})

test('a finished scan leads to its review', async () => {
  await renderWithJobs(<TasksScreen />, [
    makeJob({ kind: 'fridge_scan', status: 'succeeded', result: { draftId: 'd-9' }, progress: { total: 2, done: 2, failed: [] } }),
  ])

  await waitFor(() => expect(screen.getByTestId('task-job-1-action')).toBeTruthy())
  fireEvent.press(screen.getByTestId('task-job-1-action'))

  expect(router.push).toHaveBeenCalledWith({ pathname: '/fridge-scan/review', params: { draftId: 'd-9' } })
})

test('a failed job can be retried, and dismissed', async () => {
  const { connector } = await renderWithJobs(<TasksScreen />, [
    makeJob({ status: 'failed', error: { type: 'extraction_failed', message: 'Extraction impossible.' } }),
  ])
  const retry = jest.spyOn(connector, 'retryJob')
  const dismiss = jest.spyOn(connector, 'dismissJob')

  await waitFor(() => expect(screen.getByText('Extraction impossible.')).toBeTruthy())

  fireEvent.press(screen.getByTestId('task-job-1-action'))
  await waitFor(() => expect(retry).toHaveBeenCalledWith('job-1'))

  fireEvent.press(screen.getByTestId('task-job-1-dismiss'))
  await waitFor(() => expect(dismiss).toHaveBeenCalledWith('job-1'))
})

test('a failure no retry can fix offers no retry', async () => {
  await renderWithJobs(<TasksScreen />, [
    makeJob({ status: 'failed', error: { type: 'provider_not_configured', message: 'Provider absent.' } }),
  ])

  await waitFor(() => expect(screen.getByText('Provider absent.')).toBeTruthy())
  expect(screen.queryByTestId('task-job-1-action')).toBeNull()
  expect(screen.getByTestId('task-job-1-dismiss')).toBeTruthy()
})

test('a scan that missed photos offers a targeted retry', async () => {
  const { connector } = await renderWithJobs(<TasksScreen />, [
    makeJob({ kind: 'fridge_scan', status: 'succeeded', result: { draftId: 'd-1' }, progress: { total: 3, done: 2, failed: [1] } }),
  ])
  const retry = jest.spyOn(connector, 'retryJob')

  await waitFor(() => expect(screen.getByTestId('task-job-1-retry-failed')).toBeTruthy())
  fireEvent.press(screen.getByTestId('task-job-1-retry-failed'))

  await waitFor(() => expect(retry).toHaveBeenCalledWith('job-1'))
})

test('a hidden job stays listed under Masquées and can be deleted', async () => {
  const { connector } = await renderWithJobs(<TasksScreen />, [
    makeJob({ status: 'succeeded', result: { draftId: 'd-1' }, dismissedAt: '2026-09-20T11:00:00.000Z' }),
  ])
  const dismiss = jest.spyOn(connector, 'dismissJob')

  await waitFor(() => expect(screen.getByText('Masquées')).toBeTruthy())
  expect(screen.getByText('Rien de terminé pour le moment.')).toBeTruthy()

  expect(screen.queryByTestId('task-job-1-dismiss')).toBeNull()
  fireEvent.press(screen.getByTestId('task-job-1-delete'))
  await waitFor(() => expect(dismiss).toHaveBeenCalledWith('job-1'))
})

test('a hidden job can be restored from the swipe actions', async () => {
  const { connector } = await renderWithJobs(<TasksScreen />, [
    makeJob({ status: 'succeeded', result: { draftId: 'd-1' }, dismissedAt: '2026-09-20T11:00:00.000Z' }),
  ])
  const restore = jest.spyOn(connector, 'restoreJob')

  await waitFor(() => expect(screen.getByTestId('task-job-1-restore')).toBeTruthy())
  fireEvent.press(screen.getByTestId('task-job-1-restore'))
  await waitFor(() => expect(restore).toHaveBeenCalledWith('job-1'))
})
