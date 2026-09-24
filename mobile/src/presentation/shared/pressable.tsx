import { Pressable as RNPressable, type GestureResponderEvent, type PressableProps } from 'react-native'
import * as Haptics from 'expo-haptics'
import { haptic } from './haptics.js'

/**
 * `Pressable` with the app's confirmation tick on it — a drop-in for RN's,
 * imported in its place by every control that wants one.
 *
 * The tick used to ride `useHoverPress`'s `onPressIn`, then its `onPressOut`.
 * Neither means "this tap registered": `onPressIn` fires at touch-down, before
 * the gesture is known to be a tap at all, and `onPressOut` fires for every
 * *abandoned* press too — a finger that drags off the control, and, worse, a
 * scroll that steals the gesture, so flicking through a list of cards buzzed
 * under the finger the whole way down. `onPress` is the only callback RN fires
 * exactly when a press really happened (see Pressability's RESPONDER_RELEASE
 * branch), so the tick belongs here, wrapping it, and there is no way left to
 * spread the press handlers onto a control and get the timing wrong.
 *
 * `haptics={false}` for a control that fires its own, differently-shaped
 * feedback (a selection tick, an error notification) from inside `onPress`.
 */
export function Pressable({ onPress, haptics = true, ...rest }: PressableProps & { haptics?: boolean }) {
  return (
    <RNPressable
      {...rest}
      onPress={
        onPress
          ? (event: GestureResponderEvent) => {
              if (haptics) haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
              onPress(event)
            }
          : onPress
      }
    />
  )
}
