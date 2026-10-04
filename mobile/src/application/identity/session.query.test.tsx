import { act, renderHook, waitFor } from '@testing-library/react-native'
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


test('revalidation failures keep the last session until the server confirms absence', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  const session = { user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null } }
  const getSession = jest.spyOn(connector, 'getSession').mockResolvedValue(session)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}><ConnectorProvider connector={connector}>{children}</ConnectorProvider></QueryClientProvider>
  }
  const { result, unmount } = await renderHook(() => useSessionQuery(), { wrapper: Wrapper })
  await waitFor(() => expect(result.current.data).toEqual(session))
  for (let i = 0; i < 3; i++) {
    getSession.mockRejectedValueOnce(new Error('Network unavailable'))
    await act(async () => { await result.current.refetch() })
    expect(result.current.isError).toBe(true)
    expect(result.current.data).toEqual(session)
  }
  await act(async () => { await result.current.refetch() })
  expect(result.current.isSuccess).toBe(true)
  getSession.mockResolvedValueOnce(null)
  await act(async () => { await result.current.refetch() })
  expect(result.current.data).toBeNull()
  await unmount()
  queryClient.clear()
})

test('a failed cold-start read stays unknown and can restore the session on retry', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  const session = { user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null } }
  jest.spyOn(connector, 'getSession').mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(session)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}><ConnectorProvider connector={connector}>{children}</ConnectorProvider></QueryClientProvider>
  }
  const { result, unmount } = await renderHook(() => useSessionQuery(), { wrapper: Wrapper })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.data).toBeUndefined()
  await act(async () => { await result.current.refetch() })
  expect(result.current.data).toEqual(session)
  await unmount()
  queryClient.clear()
})
