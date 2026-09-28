/**
 * Sign-in and sign-up's background, carrying the same warm kitchen photo the
 * welcome screen opens on — the pre-auth funnel reads as one continuous
 * moment instead of a photograph handing off to a flat mint gradient one
 * screen later. `AuthBlobBackground` stays the default for every other
 * `AuthScreenChrome` caller (the threshold screen keeps its blob; nobody
 * asked for its look to change).
 *
 * The dim is `palette.scrim` used exactly as documented — "something else
 * has the floor" — spent here on the photo instead of an `ActionSheet`'s
 * backdrop, not a fresh literal invented for this screen.
 */
import { Image, StyleSheet } from 'react-native'
import { YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { KITCHEN_PHOTO } from '../shared/kitchen-photo.js'

export function AuthPhotoBackground() {
  const palette = useSoftPalette()
  return (
    <>
      <Image
        source={KITCHEN_PHOTO}
        resizeMode="cover"
        accessibilityLabel=""
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      />
      <YStack pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} />
    </>
  )
}
