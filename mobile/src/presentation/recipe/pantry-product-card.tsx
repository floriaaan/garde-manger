import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { CheckIcon } from '../dashboard/dashboard-icons.js'
import { StatusChip } from '../dashboard/status-chip.js'
import { daysUntilExpiry, expiryLabel, statusOf } from '../dashboard/product-status.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import type { Product } from '../../domain/fridge/product.js'

/**
 * One product the garde-manger offers this recipe. A card, not a chip: the
 * chip had room for a name and a clipped count, while a cook deciding what to
 * cook around wants the quantity and the date too — the same two facts the
 * fridge list's rows carry.
 *
 * Selected, it fills lime and trades its status pill for a check, so the
 * choice survives grayscale. The status pill only shows for "soon" and
 * "expired": on a fresh product it would be decoration.
 */
export function PantryProductCard({
  product,
  selected,
  onPress,
  palette,
}: {
  product: Product
  selected: boolean
  onPress: () => void
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  const days = daysUntilExpiry(product)
  const status = statusOf(days)
  const ink = selected ? palette.accentLimeText : palette.ink
  const inkSecondary = selected ? palette.accentLimeText : palette.creamText
  return (
    <Pressable
      testID={`recipes-pin-${product.id}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${product.name}, ${product.quantity.amount} ${product.quantity.unit}, ${expiryLabel(days)}`}
      android_ripple={ripple(selected ? palette.accentLimeText : palette.creamPillEdge)}
      style={[pointerCursor, rippleClip(14)]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          // `creamPill` + its hairline: this card sits on the `cream` pantry
          // card, and a near-white fill alone is 1.08:1 against it. No shadow —
          // a lifted card inside a lifted card is two surfaces fighting.
          backgroundColor={selected ? palette.accentLime : palette.creamPill}
          borderWidth={1}
          borderColor={selected ? palette.accentLime : palette.creamPillEdge}
          borderRadius={14}
          padding="$3"
          minHeight={44}
          alignItems="center"
          gap="$3"
        >
          <YStack flex={1} minWidth={0}>
            {/* Two lines: at large text sizes the status pill beside it left
                one line room for "Petits…". */}
            <Text fontSize={14} fontWeight="700" color={ink} numberOfLines={2}>
              {product.name}
            </Text>
            <Text fontSize={12} fontWeight="500" color={inkSecondary} numberOfLines={1}>
              {product.quantity.amount} {product.quantity.unit} · {expiryLabel(days)}
            </Text>
          </YStack>
          {selected ? (
            <CheckIcon size={18} color={palette.accentLimeText} />
          ) : status === 'expired' ? (
            <StatusChip status={status} bg={palette.expiredBg} color={palette.expiredText} />
          ) : status === 'soon' ? (
            <StatusChip status={status} bg={palette.soonBg} color={palette.soonText} />
          ) : null}
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
