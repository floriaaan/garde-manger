import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import type { Job } from '../../domain/job/job.js'

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    kind: 'receipt_scan',
    status: 'running',
    progress: { total: 1, done: 0, failed: [] },
    result: null,
    error: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    startedAt: '2026-09-20T10:00:01.000Z',
    finishedAt: null,
    ...overrides,
  }
}

/** A fake connector whose jobs poll answers `jobs`, so a test decides what the server says. */
export async function renderWithJobs(children: ReactNode, jobs: Job[]) {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  jest.spyOn(connector, 'getJobs').mockResolvedValue(jobs)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { connector, queryClient, ...view }
}
