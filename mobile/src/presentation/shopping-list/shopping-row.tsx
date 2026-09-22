import { useState } from 'react'
import { Animated } from 'react-native'
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
// react-native-gesture-handler's own `Pressable`, not React Native core's —
// an audit found the swipe checking the item directly instead of opening
// the actions: core `Pressable` claims RN's legacy JS touch-responder
// independently of Swipeable's native `Gesture.Pan()`, so a partial swipe
// could win the tap race before the pan gesture decided it was a drag.
// RNGH's `Pressable` is built on `Gesture.Native()` through the same
// `GestureDetector` graph as Swipeable's internal pan/tap gestures, so the
// two arbitrate correctly via native gesture-recognizer negotiation
// instead of racing across two unrelated touch systems.
import { Pressable } from 'react-native-gesture-handler'
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { HandDrawnCheck } from './hand-drawn-check.js'
import { CheckedName } from './checked-name.js'
import { useQuietRowFeedback } from './use-quiet-row-feedback.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'
import { ripple, rippleClip } from '../shared/material.js'

/**
 * How far past the actions panel (in multiples of its own width, 144pt —
 * two 72pt buttons) a right-swipe has to travel before it counts as a
 * "keep going, I mean it" full swipe and fires delete on its own — no
 * separate tap needed. `progress` is 1 at the panel's resting-open width and
 * grows unbounded past it (overshoot is unfriction'd, see `Swipeable`
 * props), so 2.5 lands around a near-full-width drag on a phone screen.
 */
const FULL_SWIPE_PROGRESS_THRESHOLD = 2.5

/**
 * Lives in its own component (not inline in `renderRightActions`) so
 * `useAnimatedReaction` attaches to a fiber of its own — a hook called from
 * inside a render-prop function runs against whichever component is
 * mid-render when `Swipeable` invokes it, which is not this row.
 */
function RowActions({
  item,
  progress,
  isOpen,
  onEdit,
  onDelete,
  swipeableMethods,
}: {
  item: ShoppingItem
  progress: SharedValue<number>
  isOpen: boolean
  onEdit: () => void
  onDelete: () => void
  swipeableMethods: SwipeableMethods
}) {
  const palette = useSoftPalette()

  // A plain closure re-created every render — cheap, and it keeps
  // `onDelete`/`swipeableMethods` current without mutating anything a
  // worklet has already captured (a `ref.current` write done that way is
  // what Reanimated's "already passed to a worklet" error warns about).
  // Passing both as dependencies makes the reaction re-subscribe with the
  // fresh closure instead of running with the one from first mount.
  function triggerFullSwipeDelete() {
    swipeableMethods.close()
    onDelete()
  }

  useAnimatedReaction(
    () => progress.value >= FULL_SWIPE_PROGRESS_THRESHOLD,
    (crossedFar, wasFar) => {
      if (crossedFar && !wasFar) {
        runOnJS(triggerFullSwipeDelete)()
      }
    },
    [swipeableMethods, onDelete],
  )

  return (
    <XStack accessibilityElementsHidden={!isOpen} importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}>
      <Pressable
        testID={`shopping-row-edit-${item.id}`}
        onPress={() => {
          swipeableMethods.close()
          onEdit()
        }}
        accessibilityRole="button"
        accessibilityLabel={`Modifier ${item.name}`}
        style={pointerCursor}
      >
        <YStack backgroundColor={palette.mintPale} alignItems="center" justifyContent="center" width={72} height="100%">
          <Text fontSize={12} fontWeight="700" color={palette.mintPaleText}>
            Modifier
          </Text>
        </YStack>
      </Pressable>
      <Pressable
        testID={`shopping-row-delete-${item.id}`}
        onPress={() => {
          swipeableMethods.close()
          onDelete()
        }}
        accessibilityRole="button"
        accessibilityLabel={`Supprimer ${item.name}`}
        style={pointerCursor}
      >
        <YStack backgroundColor={palette.expiredBg} alignItems="center" justifyContent="center" width={72} height="100%">
          <Text fontSize={12} fontWeight="700" color={palette.expiredText}>
            Supprimer
          </Text>
        </YStack>
      </Pressable>
    </XStack>
  )
}

export function ShoppingRow({
  item,
  onToggle,
  onEdit,
  onDelete,
  onLongPress,
  isLast,
}: {
  item: ShoppingItem
  onToggle: (checked: boolean) => void
  onEdit: () => void
  onDelete: () => void
  /** The non-gesture way to Modifier/Supprimer — a swipe is invisible to a
   *  first-timer and impossible for a screen-reader user. */
  onLongPress: () => void
  isLast: boolean
}) {
  const palette = useSoftPalette()
  const row = useQuietRowFeedback()
  // Tracks the swipe's actual open/closed state so the "Modifier"/"Supprimer"
  // actions can be pulled out of the accessibility tree while closed — they're
  // always mounted (just visually clipped/transformed off-screen) so a screen
  // reader could otherwise reach "Supprimer" without the swipe gesture that's
  // meant to be the intent-confirmation step (spec §3).
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Swipeable
      onSwipeableOpen={() => setIsOpen(true)}
      onSwipeableClose={() => setIsOpen(false)}
      renderRightActions={(progress, _translation, swipeableMethods) => (
        <RowActions
          item={item}
          progress={progress}
          isOpen={isOpen}
          onEdit={onEdit}
          onDelete={onDelete}
          swipeableMethods={swipeableMethods}
        />
      )}
    >
      <Pressable
        testID={`shopping-row-${item.id}`}
        onPress={() => onToggle(!item.checked)}
        onLongPress={onLongPress}
        onHoverIn={row.onHoverIn}
        onHoverOut={row.onHoverOut}
        onPressIn={row.pressIn}
        onPressOut={row.pressOut}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.name}, ${item.quantity.amount} ${item.quantity.unit}`}
        accessibilityHint="Appui long pour modifier ou supprimer"
        android_ripple={ripple(palette.ink)}
        style={[pointerCursor, rippleClip(10)]}
      >
        <Animated.View
          style={{
            opacity: row.opacity,
            backgroundColor: row.hovered ? palette.layoutSurface : 'transparent',
            borderRadius: 10,
          }}
        >
          <XStack
            alignItems="center"
            gap="$3"
            paddingVertical="$2.5"
            paddingHorizontal="$2"
            minHeight={48}
            style={!isLast ? { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: palette.paperRule } : undefined}
          >
            <YStack
              width={24}
              height={24}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={item.checked ? palette.freshBg : 'transparent'}
              style={{ borderWidth: item.checked ? 0 : 2.5, borderColor: palette.inkSecondary }}
            >
              {item.checked ? <HandDrawnCheck size={15} color={palette.freshText} /> : null}
            </YStack>
            <YStack flex={1}>
              {item.checked ? (
                <CheckedName color={palette.penMark}>{item.name}</CheckedName>
              ) : (
                <Text fontSize={14} fontWeight="700" color={palette.ink}>
                  {item.name}
                </Text>
              )}
              <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
                {item.quantity.amount} {item.quantity.unit}
              </Text>
            </YStack>
          </XStack>
        </Animated.View>
      </Pressable>
    </Swipeable>
  )
}
