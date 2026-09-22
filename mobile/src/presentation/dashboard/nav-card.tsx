import { Animated, type ImageSourcePropType } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { IllustrationSlot } from './illustration-slot.js'
import type { SoftPalette } from './soft-palette.js'

/**
 * A big, saturated, tappable category tile — "Recettes" / "Courses" —
 * given the same visual weight as the hero so the home page reads as a
 * synthesis-plus-navigation hub, not an expiry log with two footnotes.
 */
export function NavCard({
  testID,
  bg,
  glow,
  onPress,
  icon,
  imageSource,
  title,
  subtitle,
  corner,
  palette,
  accessibilityLabel,
}: {
  testID?: string
  bg: string
  glow: string
  onPress: () => void
  icon: React.ReactNode
  imageSource?: ImageSourcePropType
  title: string
  subtitle: string
  corner: 'a' | 'b'
  palette: SoftPalette
  /** Overrides the announced label — the title alone when omitted; a card whose subtitle is the reason to tap (e.g. "1 ticket · dernier : Carrefour") should pass `${title}. ${subtitle}`. */
  accessibilityLabel?: string
}) {
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 26, borderTopRightRadius: 14, borderBottomRightRadius: 26, borderBottomLeftRadius: 14 }
      : { borderTopLeftRadius: 14, borderTopRightRadius: 26, borderBottomRightRadius: 14, borderBottomLeftRadius: 26 }
  const hover = useHoverPress()

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[{ flex: 1 }, pointerCursor]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <YStack
          backgroundColor={bg}
          padding="$2.5"
          gap="$3"
          style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 4 }}
        >
          <IllustrationSlot
            height={72}
            ground={bg}
            glowStrong={glow}
            glowSoft={glow}
            icon={icon}
            imageSource={imageSource}
            tagColor="rgba(255,255,255,0.75)"
          />
          <YStack paddingHorizontal="$1.5" paddingBottom="$1.5">
            <Text fontSize={15} fontWeight="800" color={palette.onDark}>
              {title}
            </Text>
            <Text fontSize={12} fontWeight="600" color={palette.onDarkSecondary} marginTop="$0.5" numberOfLines={1}>
              {subtitle}
            </Text>
          </YStack>
        </YStack>
      </Animated.View>
    </Pressable>
  )
}
