import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Platform, Pressable } from 'react-native'
import { Text, XStack } from './tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { TOAST_PILL_STYLE, ToastPillLayer, toastPillShadow } from './toast-pill.js'
import { subscribeToast, type ToastMessage } from '../../application/shared/toast.js'
import { PulseDots } from './pulse-dots.js'

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
  const activeId = useRef<number | null>(null)

  function dismiss() {
    const dismissingId = activeId.current
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished && activeId.current === dismissingId) {
          activeId.current = null
          setToast(null)
        }
      },
    )
  }

  useEffect(() => {
    const unsubscribe = subscribeToast((next) => {
      const entering = activeId.current === null
      activeId.current = next.id
      setToast(next)
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(next.message)
      // Update a visible pending toast in place, without replaying its entrance.
      if (entering) progress.setValue(0)
      Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start()
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = next.variant === 'loading' ? null
        : setTimeout(dismiss, next.action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS)
    })
    return () => {
      unsubscribe()
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!toast) return null

  const { bg, text } =
    toast.variant === 'error'
      ? { bg: palette.expiredBg, text: palette.expiredText }
      : toast.variant === 'loading'
        ? { bg: palette.cream, text: palette.ink }
        : { bg: palette.freshBg, text: palette.freshText }

  return (
    <ToastPillLayer progress={progress} pointerEvents={toast.variant === 'loading' ? 'none' : 'box-none'}>
      <Pressable
        onPress={dismiss}
        disabled={toast.variant === 'loading'}
        accessible={false}
        style={[TOAST_PILL_STYLE, toastPillShadow(palette), { backgroundColor: bg }]}
      >
        <XStack alignItems="center" gap="$3">
          {toast.variant === 'loading' ? <PulseDots palette={palette} size={6}
            testID="toast-loading" label="Action en cours" /> : null}
          <Text fontSize={13} fontWeight="600" color={text} flexShrink={1} accessibilityLiveRegion="polite">
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              onPress={() => {
                dismiss()
                toast.action?.onPress()
              }}
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              hitSlop={8}
              style={{ minHeight: 48, justifyContent: 'center' }}
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
