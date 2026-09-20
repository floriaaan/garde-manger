import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ConfettiHost } from '../presentation/shared/confetti.js'
import { ThemeProvider } from '../presentation/shared/theme-provider.js'
import { ToastHost } from '../presentation/shared/toast.js'
import { ErrorBoundary } from '../presentation/shared/error-boundary.js'
import { ConnectorProvider } from '../application/shared/connector-context.js'
import { queryClient } from '../application/shared/query-client.js'
import { createConnector } from '../../providers/create-connector.js'
import { startTelemetry } from '../../providers/start-telemetry.js'
import { wireTelemetry } from '../../providers/wire-telemetry.js'
import { loadStoredServerUrl } from '../application/shared/server-config.js'

// Module load, not an effect: this only assigns a reference (see
// `wire-telemetry.ts`) — nothing to defer past the first frame, and every
// `getTelemetry()` call under `src/presentation` needs it wired before the
// first screen can possibly report a failure.
wireTelemetry()

export default function RootLayout() {
  // Module-level singleton, not `useState(() => new QueryClient())` — see
  // `query-client.ts`: `http-client.ts` needs the same instance to flip the
  // cached session on a 401, and a client built inside this component would
  // be unreachable from a plain module.
  const [connector] = useState(() => createConnector())

  // In an effect, not at module load: telemetry must never sit on the path
  // to the first frame. `start()` is a no-op unless
  // EXPO_PUBLIC_TELEMETRY_ENABLED is "true", and it opens no connection —
  // the first export happens 15s later, batched.
  useEffect(() => startTelemetry(), [])

  // Blocks the first render on the chosen server URL (SecureStore, falling
  // back to EXPO_PUBLIC_API_URL) — auth-client and http-client both read it
  // lazily, but a session check fired before this resolves would still race
  // against the default URL on a device that chose a different server.
  const [serverReady, setServerReady] = useState(false)
  useEffect(() => {
    loadStoredServerUrl().then(() => setServerReady(true))
  }, [])
  if (!serverReady) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConnectorProvider connector={connector}>
            <ErrorBoundary>
              {/* A Stack, not a Slot. `Réglages`, `Foyer` and `Historique des
                tickets` used to live inside `(tabs)/`, where iOS's
                `NativeTabs` only routes to the five declared triggers — so
                `router.push('/settings')` was a silent no-op on iOS and the
                only entrance to settings was dead. They are pushed screens,
                never tabs (`AppShell`'s `{ kind: 'stack' }`), so they now sit
                here as siblings of the tab group, which needs a real stack
                navigator at the root to push onto. URLs are unchanged: `(tabs)`
                is a group, so `/settings` was already `/settings`. */}
              <Stack screenOptions={{ headerShown: false }}>
                {/* The pre-auth carousel, shown once per device before `(auth)`
                  gets a chance to. It sits at the route root rather than
                  inside `(auth)` because it has no session to gate on — the
                  gate here is `(tabs)/_layout.tsx`'s own welcome-seen flag,
                  the one thing that decides whether "/" ever redirects here
                  at all. */}
                <Stack.Screen name="welcome" />
                <Stack.Screen name="server-choice" />
                <Stack.Screen name="(auth)" />
                {/* Between `(auth)` and `(tabs)`, and a sibling of both: an
                  account with no foyer is signed in but has no screen inside
                  the tabs that could honestly render, so it gets its own
                  group with its own gate. `join` is the deep-link landing
                  route for `gardemanger://join?code=…`. */}
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="join" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="account" />
                <Stack.Screen name="household" />
                <Stack.Screen name="receipts" />
                <Stack.Screen name="tasks" />
                <Stack.Screen name="home-assistant" options={{ presentation: 'modal' }} />
                <Stack.Screen name="debug" options={{ presentation: 'modal' }} />
              </Stack>
            </ErrorBoundary>
          </ConnectorProvider>
        </QueryClientProvider>
        <ToastHost />
        <ConfettiHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
