import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { LoginForm } from './login-form.js'

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

test('submitting valid credentials calls onSuccess', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<LoginForm onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('login-email'), 'a@b.com')
  await fireEvent.changeText(screen.getByTestId('login-password'), 'correct-horse-battery-staple')
  await fireEvent.press(screen.getByTestId('login-submit'))

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

test('an empty password disables submit — no request, no onSuccess', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<LoginForm onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('login-email'), 'a@b.com')
  const submit = screen.getByTestId('login-submit')
  expect(submit.props.accessibilityState.disabled).toBe(true)

  // `canSubmit` guards the handler itself too — pressing a disabled
  // `Pressable` is a no-op on a real device, but this confirms the gate
  // isn't purely cosmetic even if a press event slipped through.
  await fireEvent.press(submit)
  expect(onSuccess).not.toHaveBeenCalled()
})


test('the eye toggles visibility without changing the entered password', async () => {
  await renderWithProviders(<LoginForm onSuccess={jest.fn()} />)
  await fireEvent.changeText(screen.getByTestId('login-password'), ' secret-password ')
  expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(true)
  await fireEvent.press(screen.getByTestId('login-password-visibility'))
  expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(false)
  expect(screen.getByTestId('login-password').props.value).toBe(' secret-password ')
  await fireEvent.press(screen.getByTestId('login-password-visibility'))
  expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(true)
})
