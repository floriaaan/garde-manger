import type { ReactNode } from 'react'
import { Linking, Platform } from 'react-native'
import { Pressable } from './pressable.js'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { FormCard } from './form-card.js'
import { AuthButton } from '../identity/auth-button.js'
import { XIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * The camera-permission-denied state as a centered popup card over a
 * dimmed backdrop, not a bare full page — the previous version was an
 * unstyled `SafeAreaView` (no background) holding `palette.ink` text: on
 * native that happened to sit on the OS's own light chrome, but on web (no
 * chrome, no `BlobBackground` wrapper on this route) it rendered as flat
 * page-white behind it, and in dark mode `palette.ink` is near-white —
 * invisible text on a white page.
 *
 * Deliberately NOT React Native's `Modal`: this screen (`fridge/scan`,
 * `receipts/scan`) is itself pushed with `presentation: 'modal'` by
 * expo-router, so nesting RN `Modal`'s own portal inside a route the
 * navigator already presents as a modal is a second, independent overlay
 * layer — on web that fought the navigator's own modal chrome for
 * stacking (the backdrop never became visible, page stayed white) and,
 * closing it through `onRequestClose`/router calls from inside that
 * detached portal was implicated in "GO_BACK not handled" crashes. Plain
 * absolutely-positioned Views inside the screen's own tree side-steps
 * both: no second portal, no separate stacking context to lose.
 *
 * Also folds in the two other gaps a hard OS deny used to hit: no way
 * back out (this only ever had the request button, no close), and a dead
 * "Autoriser" button once the OS stops re-prompting (`canAskAgain: false`)
 * — that state now offers "Ouvrir les réglages" instead.
 */
export function CameraPermissionModal({
  palette,
  message,
  canAskAgain,
  onRequestPermission,
  onClose,
  requestTestID,
  closeTestID,
  children,
}: {
  palette: SoftPalette
  message: string
  // expo-camera's web implementation doesn't populate `canAskAgain`
  // meaningfully (the browser owns re-prompting, not the OS) — only
  // native ever routes to the Settings deep link.
  canAskAgain: boolean
  onRequestPermission: () => void
  onClose: () => void
  requestTestID: string
  closeTestID: string
  children?: ReactNode
}) {
  const closeHover = useHoverPress()
  const settingsFallback = Platform.OS !== 'web' && !canAskAgain

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} backgroundColor="rgba(0,0,0,0.5)" alignItems="center" justifyContent="center" padding="$4">
        <YStack width="100%" style={{ maxWidth: 360 }}>
          <FormCard palette={palette} gap="$3">
            <XStack justifyContent="flex-end">
              <Pressable
                testID={closeTestID}
                onPress={onClose}
                onHoverIn={closeHover.onHoverIn}
                onHoverOut={closeHover.onHoverOut}
                onPressIn={closeHover.onPressIn}
                onPressOut={closeHover.onPressOut}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                // The glyph is 20pt; the press area is not. Without this the
                // tappable region was the size of the icon — the only control
                // in the app under the 44pt floor.
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={pointerCursor}
              >
                <XIcon size={20} color={palette.inkSecondary} />
              </Pressable>
            </XStack>

            <Text fontSize={14} color={palette.ink} textAlign="center">
              {message}
            </Text>

            <AuthButton
              testID={requestTestID}
              label={settingsFallback ? 'Ouvrir les réglages' : 'Autoriser la caméra'}
              onPress={settingsFallback ? () => Linking.openSettings() : onRequestPermission}
            />

            {children}
          </FormCard>
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}
