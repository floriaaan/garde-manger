import { useTranslation } from '../../i18n/index.js'
/** Shared mascot lockup for the entry flow; development triple-tap opens debug. */
import { useRef } from 'react'
import { Image, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const mascotIllustration = require('../../../assets/mascot.png')

const TRIPLE_TAP_MS = 600

export function AuthWordmark({ tone, garden = false, color, fontFamily }: { tone: 'ink' | 'on-dark'; garden?: boolean; color?: string; fontFamily?: string }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const taps = useRef<number[]>([])
  // Triple tap opens the debug modal in dev builds only — a hidden feature in
  // a release build is an App Store rejection (2.3.1). No a11y role/label.
  function onTap() {
    if (!__DEV__) return
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < TRIPLE_TAP_MS), now]
    if (taps.current.length >= 3) {
      taps.current = []
      router.push('/debug')
    }
  }
  return (
    <Pressable onPress={onTap} accessible={false} style={{ alignSelf: garden ? 'flex-start' : 'center' }}>
    {garden ? <Text style={{ fontFamily, fontSize: 18, fontWeight: fontFamily ? '400' : '800', letterSpacing: -0.5, color: color ?? palette.ink }}>{t('fridge.pantry')}</Text> : (
    <XStack alignItems="center" gap="$2" alignSelf="center">
      {/* 56, not the carrot glyph's old 36 — the mascot is a full character
          (face, arms, a held leaf), not a simple icon shape, and needs more
          pixels than a flat glyph to read as anything at this size. */}
      <Image source={mascotIllustration} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="" />
      <Text fontSize={16} fontWeight="800" letterSpacing={1} color={tone === 'on-dark' ? palette.onDark : palette.ink}>{t('identity.garde_manger')}</Text>
    </XStack>
    )}
    </Pressable>
  )
}
