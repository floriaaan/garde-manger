import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import type { SoftPalette } from './soft-palette.js'

export function StatCard({
  testID,
  bg,
  labelColor,
  valueColor,
  chipColor,
  icon,
  label,
  value,
  secondary,
  corner,
  palette,
  onPress,
  accessibilityLabel,
}: {
  testID?: string
  bg: string
  labelColor: string
  valueColor: string
  chipColor: string
  icon: React.ReactNode
  label: string
  value: string
  /** Optional third line under `value` — smaller, `labelColor`-toned. No caller passes it today: Réglages' account and foyer cards moved to `IdentityCard`, which owns the "card that carries a name" shape. */
  secondary?: string
  corner: 'a' | 'b' | 'c'
  palette: SoftPalette
  /**
   * Makes the card the way *into* what it counts. A metric that names a set of
   * products and then refuses to show them is a dead end dressed as a summary
   * — the whole reason these three became links.
   *
   * Optional, because a card that leads nowhere must stay inert rather than
   * spring under the finger and do nothing.
   */
  onPress?: () => void
  /** What a screen reader announces; the drawn label is only half the sentence ("Cette semaine" · "3"). */
  accessibilityLabel?: string
}) {
  // Three slightly different asymmetric corner sets so the row of pastel
  // cards reads as expressive/organic rather than three identical stamps.
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 26, borderTopRightRadius: 14, borderBottomRightRadius: 26, borderBottomLeftRadius: 14 }
      : corner === 'b'
        ? { borderTopLeftRadius: 14, borderTopRightRadius: 26, borderBottomRightRadius: 14, borderBottomLeftRadius: 26 }
        : { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 14, borderBottomLeftRadius: 14 }

  const hover = useHoverPress()

  const card = (
    <YStack
      testID={onPress ? undefined : testID}
      flex={1}
      minHeight={128}
      backgroundColor={bg}
      padding="$4"
      gap="$2"
      style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 }}
    >
      <YStack width={36} height={36} borderRadius={12} backgroundColor={chipColor} alignItems="center" justifyContent="center">
        {icon}
      </YStack>
      <YStack>
        <Text fontSize={12} fontWeight="500" color={labelColor}>
          {label}
        </Text>
        <Text fontSize={22} fontWeight="800" color={valueColor} marginTop="$1" numberOfLines={1}>
          {value}
        </Text>
        {secondary ? (
          <Text fontSize={12} fontWeight="500" color={labelColor} marginTop="$0.5" numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )

  if (!onPress) return card

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      // The card used to *be* the row's flex child; it is now two levels down,
      // so *this* level (the row's direct child) carries `flex: 1` for width
      // — three equal columns. `Animated.View` below is a single-child
      // pass-through, not a row participant, so it must NOT repeat
      // `flex: 1` (i.e. `flex-basis: 0`): react-native-web's base View rule
      // forces `min-height: 0` on every View, and a `flex-basis: 0` item is
      // then free to size *below* its own content's height where native
      // Yoga wouldn't — the pastel card would collapse to a sliver and its
      // icon+label+value would spill out under it into the next section
      // (caught live on web: "Dates dépassées" wraps to two lines where the
      // others don't, and shorter cards clipped their own content). Its
      // `alignSelf: 'stretch'` alone still fills this button's cross-axis
      // (width, in this column-direction wrapper) with no grow/shrink-driven
      // height collapse.
      style={[{ flex: 1, alignSelf: 'stretch' }, pointerCursor]}
    >
      <Animated.View style={{ alignSelf: 'stretch', transform: [{ scale: hover.scale }] }}>{card}</Animated.View>
    </Pressable>
  )
}
