import { useTranslation } from '../../i18n/index.js'
import { useId } from 'react'
import { Image, type ImageSourcePropType } from 'react-native'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'

/**
 * The illustration area above each big tile's title — a soft blurred
 * radial-gradient glow (same technique as `BlobBackground`) behind either
 * a real 3D illustration (`imageSource`, a bundled asset) or, failing
 * that, a flat icon tagged as a placeholder. Real 3D renders: Microsoft's
 * Fluent Emoji 3D set (MIT-licensed) — see assets/illustrations/NOTICE.md.
 *
 * Clipping is belt-and-suspenders (`overflow` prop + `style.overflow` +
 * matching `style` border radius): react-native-web's default SVG root
 * doesn't always inherit a parent View's `overflow:hidden` the way native
 * does, and the glow bleeding past its own rounded corner is exactly the
 * bug that shipped here once already.
 */
export function IllustrationSlot({
  height,
  width,
  radius = 18,
  ground,
  glowStrong,
  glowSoft,
  icon,
  imageSource,
  tagColor,
}: {
  height: number
  width?: number
  radius?: number
  ground: string
  glowStrong: string
  glowSoft: string
  icon: React.ReactNode
  imageSource?: ImageSourcePropType
  tagColor: string
}) {
  const { t } = useTranslation()
  const gradientId = useId()
  return (
    <YStack
      height={height}
      width={width}
      overflow="hidden"
      backgroundColor={ground}
      style={{ borderRadius: radius, position: 'relative' }}
    >
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="45%" r="58%">
            <Stop offset="0" stopColor={glowStrong} stopOpacity={0.85} />
            <Stop offset="0.55" stopColor={glowSoft} stopOpacity={0.4} />
            <Stop offset="1" stopColor={ground} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <YStack flex={1} alignItems="center" justifyContent="center">
        {imageSource ? (
          <Image source={imageSource} style={{ width: height * 0.72, height: height * 0.72 }} resizeMode="contain" />
        ) : (
          icon
        )}
      </YStack>
      {imageSource ? null : (
        <XStack position="absolute" bottom={6} right={8} backgroundColor="rgba(0,0,0,0.22)" borderRadius={999} paddingVertical="$0.5" paddingHorizontal="$2">
          <Text fontSize={9} fontWeight="700" color={tagColor}>{t('dashboard.3d_coming_soon')}</Text>
        </XStack>
      )}
    </YStack>
  )
}
