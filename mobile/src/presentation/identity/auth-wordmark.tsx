/**
 * The mascot+"GARDE-MANGER" lockup — shared by `AuthScreenChrome` (the
 * threshold's blob ground, `tone="ink"`) and `AuthShell` (sign-in/sign-up's
 * photo ground, `tone="on-dark"`). Pulled out once a second copy of it was
 * about to exist with the only difference being which palette token the
 * label used.
 */
import { useRef } from 'react'
import { Image, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const mascotIllustration = require('../../../assets/mascot.png')

const TRIPLE_TAP_MS = 600

export function AuthWordmark({ tone }: { tone: 'ink' | 'on-dark' }) {
  const palette = useSoftPalette()
  const taps = useRef<number[]>([])
  // Triple tap opens the debug modal — a hidden door, so no a11y role/label.
  function onTap() {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < TRIPLE_TAP_MS), now]
    if (taps.current.length >= 3) {
      taps.current = []
      router.push('/debug')
    }
  }
  return (
    <Pressable onPress={onTap} accessible={false} style={{ alignSelf: 'center' }}>
    <XStack alignItems="center" gap="$2" alignSelf="center">
      {/* 56, not the carrot glyph's old 36 — the mascot is a full character
          (face, arms, a held leaf), not a simple icon shape, and needs more
          pixels than a flat glyph to read as anything at this size. */}
      <Image source={mascotIllustration} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="" />
      <Text fontSize={16} fontWeight="800" letterSpacing={1} color={tone === 'on-dark' ? palette.onDark : palette.ink}>
        GARDE-MANGER
      </Text>
    </XStack>
    </Pressable>
  )
}
