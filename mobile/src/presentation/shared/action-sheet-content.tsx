import { ActivityIndicator, Animated } from 'react-native'
import { Pressable } from './pressable.js'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ChevronRightIcon } from '../dashboard/dashboard-icons.js'
import { ripple, rippleClip } from './material.js'

export interface ActionSheetOption {
  /** Keep the native sheet open for an inline second step. */
  keepOpen?: boolean
  disabled?: boolean
  pending?: boolean
  testID: string
  label: string
  /** Rendered inside a `tint`-colored 36×36 chip — same shape as settings' row icons. */
  icon: (color: string) => React.ReactNode
  tint: string
  onPress: () => void
  /** Irreversible: the row carries the status-expired colors and names the consequence. */
  destructive?: boolean
  /**
   * A correction, not a real option — same size and weight as every other
   * row (DESIGN.md: hierarchy is never colour alone), but the label takes
   * `inkSecondary` rather than `ink`, the same treatment "Annuler" already
   * carries below. A distinct icon-chip tint on its own left the label
   * reading exactly as loud as "Consommé"/"Jeté".
   */
  quiet?: boolean
}

/** One option — styled as its own card-button, matching settings' "Historique des tickets" row. */
export function ActionSheetRow({ option, palette }: { option: ActionSheetOption; palette: SoftPalette }) {
  const hover = useHoverPress()
  const inert = Boolean(option.disabled || option.pending)
  return (
    <Pressable
      testID={option.testID}
      onPress={option.onPress}
      disabled={inert}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ disabled: inert, busy: Boolean(option.pending) }}
      android_ripple={ripple(option.destructive ? palette.expiredText : palette.ink)}
      style={[pointerCursor, rippleClip(16)]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: inert ? 0.6 : 1 }}>
        <XStack
          alignItems="center"
          gap="$3"
          backgroundColor={option.destructive ? palette.expiredBg : palette.gradientBottom}
          borderRadius={16}
          padding="$3"
          minHeight={44}
          style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 }}
        >
          <YStack width={36} height={36} borderRadius={12} backgroundColor={option.tint} alignItems="center" justifyContent="center">
            {option.pending ? <ActivityIndicator testID={`${option.testID}-spinner`} color={palette.onDark} /> : option.icon(palette.onDark)}
          </YStack>
          <Text
            fontSize={14}
            fontWeight="700"
            color={option.destructive ? palette.expiredText : option.quiet ? palette.inkSecondary : palette.ink}
            flex={1}
          >
            {option.label}
          </Text>
          <ChevronRightIcon size={18} color={palette.inkSecondary} />
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
