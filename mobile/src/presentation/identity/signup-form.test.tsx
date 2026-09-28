import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SignupForm } from './signup-form.js'
import zxcvbn from 'zxcvbn'

jest.mock('zxcvbn', () => jest.fn(() => ({ score: 2 })))

// @testing-library/react-native v14: render() AND fireEvent (press/changeText/
// scroll) are async by default, both return a Promise — every call below must
// be awaited (cf. Task 2's report; this bit the mobile test harness once already).
//
// ThemeProvider (TamaguiProvider) wrapping is required here: any styled Tamagui
// component (YStack, Input, Button…) internally wraps itself with a `<Theme>`
// that resolves against a root theme context — without one somewhere in the
// tree, tamagui throws "Missing theme." at render time, regardless of which
// component tree is under test.
function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}


test('a large pasted password has bounded scoring, cannot submit, and is not silently truncated', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<SignupForm onSuccess={onSuccess} />)
  await fireEvent.changeText(screen.getByTestId('signup-name'), 'Alice')
  await fireEvent.changeText(screen.getByTestId('signup-email'), 'alice@example.com')
  const password = 'long-pasted-password'.repeat(100)
  await fireEvent.changeText(screen.getByTestId('signup-password'), password)
  expect(zxcvbn).toHaveBeenLastCalledWith(password.slice(0, 100), ['Alice', 'alice@example.com'])
  expect(screen.getByTestId('signup-password').props.value).toBe(password)
  expect(screen.getByTestId('signup-submit').props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(screen.getByTestId('signup-submit'))
  expect(onSuccess).not.toHaveBeenCalled()

  jest.mocked(zxcvbn).mockClear()
  await fireEvent.press(screen.getByTestId('signup-password-visibility'))
  expect(zxcvbn).not.toHaveBeenCalled()
})

test('a valid password can still create an account', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<SignupForm onSuccess={onSuccess} />)
  await fireEvent.changeText(screen.getByTestId('signup-name'), 'Alice')
  await fireEvent.changeText(screen.getByTestId('signup-email'), 'alice@example.com')
  await fireEvent.changeText(screen.getByTestId('signup-password'), 'correct-horse-battery-staple')
  await fireEvent.press(screen.getByTestId('signup-submit'))
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})
