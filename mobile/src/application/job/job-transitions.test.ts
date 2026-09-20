import { findFinishedTransitions } from './job-transitions.js'
import type { Job } from '../../domain/job/job.js'

function job(id: string, status: Job['status']): Job {
  return {
    id,
    kind: 'receipt_scan',
    status,
    progress: { total: 1, done: 0, failed: [] },
    result: null,
    error: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
  }
}

test('reports a job that went from active to finished, once', () => {
  const previous = new Map([['a', job('a', 'running')]])

  expect(findFinishedTransitions(previous, [job('a', 'succeeded')]).map((j) => j.id)).toEqual(['a'])
  expect(findFinishedTransitions(new Map([['a', job('a', 'succeeded')]]), [job('a', 'succeeded')])).toEqual([])
})

test('a job already finished the first time it is seen is not news', () => {
  expect(findFinishedTransitions(new Map(), [job('a', 'succeeded'), job('b', 'failed')])).toEqual([])
})

test('a still-running job is not reported', () => {
  const previous = new Map([['a', job('a', 'queued')]])

  expect(findFinishedTransitions(previous, [job('a', 'running')])).toEqual([])
})
