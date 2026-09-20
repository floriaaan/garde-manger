import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable } from 'react-native'
import { Text, XStack } from './tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { TOAST_PILL_STYLE, ToastPillLayer, toastPillShadow } from './toast-pill.js'
import { subscribeToast, type ToastMessage } from '../../application/shared/toast.js'

const AUTO_DISMISS_MS = 3500
// A toast with a tap-through gets longer: the thumb has to find it.
const ACTION_DISMISS_MS = 7000

/** Mounted once at the app root, overlaying every screen. Renders nothing until the first `showToast` call. */
export function ToastHost() {
  const palette = useSoftPalette()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  // `useState`, not `useRef`: the `Animated.Value` instance is read directly
  // in the JSX style below, and the compiler's ref rule flags any ref
  // `.current` read during render — same idiom as `hint-bubble.tsx`.
  const [progress] = useState(() => new Animated.Value(0))
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function dismiss() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setToast(null)
      },
    )
  }

  useEffect(() => {
    return subscribeToast((next) => {
      setToast(next)
      progress.setValue(0)
      Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start()
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = setTimeout(dismiss, next.action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!toast) return null

  const { bg, text } =
    toast.variant === 'error'
      ? { bg: palette.expiredBg, text: palette.expiredText }
      : { bg: palette.freshBg, text: palette.freshText }

  return (
    <ToastPillLayer progress={progress} pointerEvents="box-none">
      <Pressable
        onPress={dismiss}
        style={[TOAST_PILL_STYLE, toastPillShadow(palette), { backgroundColor: bg }]}
      >
        <XStack alignItems="center" gap="$3">
          <Text fontSize={13} fontWeight="600" color={text} flexShrink={1}>
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              onPress={() => {
                toast.action?.onPress()
                dismiss()
              }}
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              hitSlop={8}
            >
              <Text fontSize={13} fontWeight="800" color={text} textDecorationLine="underline">
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}
        </XStack>
      </Pressable>
    </ToastPillLayer>
  )
}
