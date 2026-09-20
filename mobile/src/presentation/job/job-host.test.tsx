import { act, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { JobHost } from './job-host.js'
import { JOBS_KEY } from '../../application/job/jobs.query.js'
import { useWatchJob } from '../../application/job/watched-jobs.js'
import { showToast } from '../../application/shared/toast.js'
import { celebrate } from '../../application/shared/confetti.js'
import { makeJob, renderWithJobs } from './test-utils.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: jest.fn(() => '/') }))
jest.mock('../../application/shared/toast.js', () => ({ showToast: jest.fn() }))
jest.mock('../../application/shared/confetti.js', () => ({ celebrate: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

function Watcher({ id }: { id: string }) {
  useWatchJob(id)
  return null
}

test('a job that finishes while nobody watches it raises one toast that leads to the review', async () => {
  const running = makeJob()
  const { queryClient } = await renderWithJobs(<JobHost />, [running])
  await waitFor(() => expect(queryClient.getQueryData(JOBS_KEY)).toEqual([running]))
  await act(async () => {})

  const done = makeJob({ status: 'succeeded', result: { draftId: 'd-1' }, finishedAt: '2026-09-20T10:00:09.000Z' })
  await act(async () => {
    queryClient.setQueryData(JOBS_KEY, [done])
  })
  // Same data again (a later poll): still one toast.
  await act(async () => {
    queryClient.setQueryData(JOBS_KEY, [{ ...done }])
  })

  expect(showToast).toHaveBeenCalledTimes(1)
  const [message, variant, action] = (showToast as jest.Mock).mock.calls[0]
  expect(message).toContain('Ticket analysé')
  expect(variant).toBe('success')
  expect(action.label).toBe('Relire')

  action.onPress()
  expect(router.push).toHaveBeenCalledWith({ pathname: '/receipts/review', params: { draftId: 'd-1' } })
})

test('a job a screen is watching gets no toast', async () => {
  const running = makeJob()
  const { queryClient } = await renderWithJobs(
    <>
      <Watcher id="job-1" />
      <JobHost />
    </>,
    [running],
  )
  await waitFor(() => expect(queryClient.getQueryData(JOBS_KEY)).toEqual([running]))
  await act(async () => {})

  await act(async () => {
    queryClient.setQueryData(JOBS_KEY, [makeJob({ status: 'succeeded', result: { draftId: 'd-1' } })])
  })

  expect(showToast).not.toHaveBeenCalled()
})

test('a job already finished when the app opens is not announced', async () => {
  const { queryClient } = await renderWithJobs(<JobHost />, [makeJob({ status: 'succeeded', result: { draftId: 'd-1' } })])
  await waitFor(() => expect(queryClient.getQueryData(JOBS_KEY)).toHaveLength(1))
  await act(async () => {})

  expect(showToast).not.toHaveBeenCalled()
})

test('a failure toast leads to the task center; recipes celebrate', async () => {
  const { queryClient } = await renderWithJobs(<JobHost />, [
    makeJob({ id: 'a' }),
    makeJob({ id: 'b', kind: 'recipe_generation' }),
  ])
  await waitFor(() => expect(queryClient.getQueryData(JOBS_KEY)).toHaveLength(2))
  await act(async () => {})

  await act(async () => {
    queryClient.setQueryData(JOBS_KEY, [
      makeJob({ id: 'a', status: 'failed', error: { type: 'extraction_failed', message: 'Échec.' } }),
      makeJob({ id: 'b', kind: 'recipe_generation', status: 'succeeded', result: { recipeIds: ['r1', 'r2'] } }),
    ])
  })

  const calls = (showToast as jest.Mock).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls.find(([, variant]) => variant === 'error')?.[2].label).toBe('Voir')
  expect(celebrate).toHaveBeenCalledTimes(1)
})
