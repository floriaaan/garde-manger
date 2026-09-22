/**
 * Everything drawn over a live camera feed, shared by the three scanners
 * (code-barres, ticket, frigo).
 *
 * Each scanner used to hand-roll its own overlay and they had drifted: the
 * fridge scanner floated its shutter inside the framing guide, away from the
 * gallery button; the barcode scanner had no guide and no instruction at
 * all; and the "Galerie" pill was a white fill carrying `palette.ink`, which
 * is near-white in dark mode — white on white. Anything over the feed now
 * sits on `cameraScrim` with `onDark` ink, because the feed never follows
 * the theme.
 *
 * One layout for all three: close top-left, the guide and its one-line
 * instruction in the middle, and a bottom bar with three fixed slots
 * (start / shutter / end) so the shutter never moves under the thumb when a
 * slot is empty.
 */
import type { ReactNode } from 'react'
import { Animated } from 'react-native'
import { Pressable } from './pressable.js'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { XIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/** The shape of what is being framed: a long receipt, a whole shelf, a barcode strip. */
export type CameraGuide = 'receipt' | 'fridge' | 'barcode'

const GUIDE_SIZE: Record<CameraGuide, { width: `${number}%`; flex?: number; height?: number }> = {
  receipt: { width: '62%', flex: 1 },
  fridge: { width: '86%', flex: 1 },
  barcode: { width: '80%', height: 150 },
}

export function CameraChrome({
  palette,
  guide,
  hint,
  onClose,
  closeTestID,
  tray,
  start,
  shutter,
  end,
}: {
  palette: SoftPalette
  guide: CameraGuide
  hint: string
  onClose: () => void
  closeTestID: string
  /** A row above the bottom bar (the fridge scanner's thumbnails). */
  tray?: ReactNode
  start?: ReactNode
  shutter?: ReactNode
  end?: ReactNode
}) {
  const hasBar = Boolean(start || shutter || end)

  return (
    <YStack position="absolute" top={0} bottom={0} left={0} right={0} style={{ pointerEvents: 'box-none' }}>
      <SafeAreaView edges={['top']} style={{ pointerEvents: 'box-none' }}>
        <XStack paddingHorizontal="$3" paddingTop="$2" style={{ pointerEvents: 'box-none' }}>
          <Pressable
            testID={closeTestID}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer le scanner"
            style={pointerCursor}
          >
            <YStack width={44} height={44} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor={palette.cameraScrim}>
              <XIcon size={22} color={palette.onDark} />
            </YStack>
          </Pressable>
        </XStack>
      </SafeAreaView>

      <YStack flex={1} minHeight={0} alignItems="center" justifyContent="center" gap="$4" paddingVertical="$4" style={{ pointerEvents: 'none' }}>
        <GuideFrame palette={palette} guide={guide} />
        <YStack backgroundColor={palette.cameraScrim} borderRadius={999} paddingVertical="$2" paddingHorizontal="$4" maxWidth="90%">
          <Text fontSize={13} fontWeight="700" color={palette.onDark} textAlign="center" accessibilityLiveRegion="polite">
            {hint}
          </Text>
        </YStack>
      </YStack>

      {hasBar || tray ? (
        <SafeAreaView edges={['bottom']} style={{ pointerEvents: 'box-none' }}>
          <YStack gap="$3" paddingTop="$2" paddingBottom="$4" style={{ pointerEvents: 'box-none' }}>
            {tray}
            {hasBar ? (
              <XStack alignItems="center" paddingHorizontal="$5" style={{ pointerEvents: 'box-none' }}>
                <XStack flex={1} justifyContent="flex-start" style={{ pointerEvents: 'box-none' }}>
                  {start}
                </XStack>
                <YStack width={76} alignItems="center" style={{ pointerEvents: 'box-none' }}>
                  {shutter}
                </YStack>
                <XStack flex={1} justifyContent="flex-end" style={{ pointerEvents: 'box-none' }}>
                  {end}
                </XStack>
              </XStack>
            ) : null}
          </YStack>
        </SafeAreaView>
      ) : null}
    </YStack>
  )
}

/** Four corner brackets rather than a closed outline: the subject is framed, not boxed in. */
function GuideFrame({ palette, guide }: { palette: SoftPalette; guide: CameraGuide }) {
  const arm = guide === 'barcode' ? 24 : 32
  const corner = { position: 'absolute' as const, width: arm, height: arm, borderColor: palette.onDark }
  return (
    <YStack {...GUIDE_SIZE[guide]} minHeight={0}>
      <YStack style={{ ...corner, top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }} />
      <YStack style={{ ...corner, top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }} />
      <YStack style={{ ...corner, bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }} />
      <YStack style={{ ...corner, bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 }} />
    </YStack>
  )
}

export function ShutterButton({
  palette,
  testID,
  onPress,
  disabled = false,
}: {
  palette: SoftPalette
  testID: string
  onPress: () => void
  disabled?: boolean
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Prendre la photo"
      accessibilityState={{ disabled }}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: disabled ? 0.45 : 1 }}>
        <YStack width={76} height={76} borderRadius={999} borderWidth={4} borderColor={palette.onDark} alignItems="center" justifyContent="center">
          <YStack width={58} height={58} borderRadius={999} backgroundColor={palette.accentLime} />
        </YStack>
      </Animated.View>
    </Pressable>
  )
}

/** A round glyph on the camera scrim with its word under it — "Galerie" is not a guessable icon alone. */
export function CameraRoundButton({
  palette,
  testID,
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  palette: SoftPalette
  testID: string
  icon: (color: string) => ReactNode
  label: string
  accessibilityLabel: string
  onPress: () => void
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], alignItems: 'center', gap: 6 }}>
        <YStack width={52} height={52} borderRadius={999} backgroundColor={palette.cameraScrim} alignItems="center" justifyContent="center">
          {icon(palette.onDark)}
        </YStack>
        <YStack backgroundColor={palette.cameraScrim} borderRadius={999} paddingHorizontal="$2" paddingVertical={2}>
          <Text fontSize={11} fontWeight="700" color={palette.onDark}>
            {label}
          </Text>
        </YStack>
      </Animated.View>
    </Pressable>
  )
}
