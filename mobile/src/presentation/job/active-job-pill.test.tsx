import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router, usePathname } from 'expo-router'
import { ActiveJobPill } from './active-job-pill.js'
import { makeJob, renderWithJobs } from './test-utils.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: jest.fn(() => '/') }))

beforeEach(() => {
  jest.clearAllMocks()
  ;(usePathname as jest.Mock).mockReturnValue('/')
})

test('renders nothing when no job is active', async () => {
  const { connector } = await renderWithJobs(<ActiveJobPill />, [makeJob({ status: 'succeeded' })])
  await waitFor(() => expect(connector.getJobs).toHaveBeenCalled())

  expect(screen.queryByTestId('active-job-pill')).toBeNull()
})

test('shows the running job, with photo progress for a fridge scan, and opens the task center', async () => {
  await renderWithJobs(<ActiveJobPill />, [
    makeJob({ kind: 'fridge_scan', progress: { total: 5, done: 3, failed: [] } }),
  ])

  await waitFor(() => expect(screen.getByTestId('active-job-pill')).toBeTruthy())
  expect(screen.getByText('Analyse du frigo')).toBeTruthy()
  expect(screen.getByText('3/5')).toBeTruthy()

  fireEvent.press(screen.getByTestId('active-job-pill'))
  expect(router.push).toHaveBeenCalledWith('/tasks')
})

test('counts the other active jobs instead of stacking pills', async () => {
  await renderWithJobs(<ActiveJobPill />, [makeJob({ id: 'b', status: 'queued' }), makeJob({ id: 'a' })])

  await waitFor(() => expect(screen.getByText(/\+1/)).toBeTruthy())
  expect(screen.getAllByTestId('active-job-pill')).toHaveLength(1)
})

test('hides itself on the task center, where the same information is the page', async () => {
  ;(usePathname as jest.Mock).mockReturnValue('/tasks')
  const { connector } = await renderWithJobs(<ActiveJobPill />, [makeJob()])
  await waitFor(() => expect(connector.getJobs).toHaveBeenCalled())

  expect(screen.queryByTestId('active-job-pill')).toBeNull()
})
