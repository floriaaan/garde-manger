import { useCallback, useState, type ReactNode } from 'react'
import { Image } from 'react-native'
import { SvgUri } from 'react-native-svg'
import { Text, YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function Avatar({
  name,
  image,
  size = 36,
  palette,
  backgroundColor = palette.navCardTeal,
  color = palette.onDark,
}: {
  name: string
  image?: string | null
  size?: number
  palette: SoftPalette
  backgroundColor?: string
  color?: string
}) {
  return (
    <YStack
      width={size}
      height={size}
      flexShrink={0}
      borderRadius={999}
      backgroundColor={backgroundColor}
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Avatar de ${name || '?'}`}
    >
      {/* A new URL retries the image after a previous loading failure. */}
      <AvatarImage key={image ?? ''} image={image} size={size}>
        <Text fontSize={Math.round(size * 0.4)} fontWeight="800" color={color}>
          {initials(name)}
        </Text>
      </AvatarImage>
    </YStack>
  )
}

function AvatarImage({ image, size, children }: {
  image?: string | null
  size: number
  children: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const onError = useCallback(() => setFailed(true), [])
  if (!image || failed) return children
  if (/(?:\.svg|\/svg)(?:[?#]|$)/i.test(image)) {
    return <SvgUri testID="avatar-image" uri={image} width={size} height={size} onError={onError} />
  }
  return <Image testID="avatar-image" source={{ uri: image }} style={{ width: size, height: size }} resizeMode="cover" onError={onError} />
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
