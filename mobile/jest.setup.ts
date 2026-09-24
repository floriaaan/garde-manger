// @testing-library/react-native v12.4+ (we're on v14) auto-extends Jest's `expect`
// with its matchers (toBeTruthy, toHaveTextContent, etc.) — the `extend-expect`
// subpath the brief specified no longer exists in this version and would fail to
// resolve. No import is needed here; this file is kept as the `setupFiles` entry
// point for any future global test setup.

// Tamagui components (YStack, Text, Button, Input…) call `getConfig()` at
// render time and throw "Missing tamagui config" unless `createTamagui()` has
// run first as a side effect. The app wires this by importing tamagui.config
// via ThemeProvider (src/app/_layout.tsx), but component tests (e.g.
// login-form.test.tsx) render a form directly without mounting ThemeProvider
// — so the config must be registered globally here instead.
import './tamagui.config'

// React Query's `notifyManager` batches subscriber notifications through a
// real `setTimeout(fn, 0)` by default — a macrotask nothing in RNTL's
// `waitFor`/`act` machinery waits on. A screen with more than one
// query/mutation (settings, home-assistant) can leave one of these timers
// still pending when a test ends; it then fires mid-setup of the *next*
// test in the same file, landing a state update outside any `act()` scope
// ("An update to X was not wrapped in act(...)", "overlapping act() calls")
// and intermittently making that next test's very first render query find
// nothing, even though the component it's querying was never broken.
// Notifying synchronously — React Query's own documented fix for test
// environments — removes the leftover timer entirely, so there is nothing
// left to bleed into the following test.
// import { notifyManager } from '@tanstack/react-query'
// notifyManager.setNotifyFunction((fn) => fn())
// notifyManager.setBatchNotifyFunction((fn) => fn())

// `@react-native-community/datetimepicker` is a native view (`DateField`, used
// by every expiry field) — under Jest it renders nothing testable and its real
// `onChange` only arrives from native code. This stand-in keeps the props on a
// host `View`, so a test picks a date the way a member does:
// `fireEvent(getByTestId('…-expires-at-picker'), 'change', { type: 'set' }, new Date(…))`.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement(View, props),
  }
})

export {}
