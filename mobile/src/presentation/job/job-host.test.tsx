import { act, waitFor } from '@testing-library/react-native'
import { JobHost } from './job-host.js'
import { JOBS_KEY } from '../../application/job/jobs.query.js'
import { showToast } from '../../application/shared/toast.js'
import { celebrate } from '../../application/shared/confetti.js'
import { makeJob, renderWithJobs } from './test-utils.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: jest.fn(() => '/') }))
jest.mock('../../application/shared/toast.js', () => ({ showToast: jest.fn() }))
jest.mock('../../application/shared/confetti.js', () => ({ celebrate: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

test('a job already finished when the app opens is not announced', async () => {
  const { queryClient } = await renderWithJobs(<JobHost />, [makeJob({ status: 'succeeded', result: { draftId: 'd-1' } })])
  await waitFor(() => expect(queryClient.getQueryData(JOBS_KEY)).toHaveLength(1))
  await act(async () => {})

  expect(showToast).not.toHaveBeenCalled()
  expect(celebrate).not.toHaveBeenCalled()
})
