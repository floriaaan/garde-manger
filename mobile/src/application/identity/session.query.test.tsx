import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { useSessionQuery } from './session.query.js'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </QueryClientProvider>
  )
}

test('useSessionQuery() resolves to null when the fake connector has no session', async () => {
  // @testing-library/react-native v14: renderHook() is async, must be awaited
  // (result.current itself stays synchronous once awaited — cf. Task 2's report).
  const { result } = await renderHook(() => useSessionQuery(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toBeNull()
})
