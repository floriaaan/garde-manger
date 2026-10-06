/**
 * Up to three overlapping avatars, then a "+N" disc — the foyer made visible.
 *
 * It lived in `settings/identity-card.tsx` and rendered in exactly one place:
 * Réglages → Foyer, two taps in, on a screen nobody opens. The one thing that
 * separates this product from a personal fridge tracker is that several people
 * share the shelf, and it was invisible everywhere the product is actually
 * used. It sits in `shared/` now because the dashboard shows it too.
 */
import { Text, XStack, YStack } from './tamagui-typed.js'
import { Avatar } from './avatar.js'
import type { HouseholdMember } from '../../domain/identity/household.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function MemberAvatars({
  members,
  palette,
  max = 3,
}: {
  members: readonly Pick<HouseholdMember, 'name' | 'image'>[]
  palette: SoftPalette
  max?: number
}) {
  if (members.length === 0) return null
  const shown = members.slice(0, max)
  const rest = members.length - shown.length

  return (
    <XStack alignItems="center" gap="$2">
      <XStack alignItems="center">
        {shown.map(({ name, image }, index) => (
          <YStack
            key={`${name}-${index}`}
            flexShrink={0}
            marginLeft={index === 0 ? 0 : -8}
          >
            <Avatar name={name} image={image} size={26} palette={palette} />
          </YStack>
        ))}
        {rest > 0 ? (
          <YStack width={26} height={26} borderRadius={999} backgroundColor={palette.gradientBottom} alignItems="center" justifyContent="center" marginLeft={-8}>
            <Text fontSize={11} fontWeight="800" color={palette.mintPaleText}>
              +{rest}
            </Text>
          </YStack>
        ) : null}
      </XStack>
    </XStack>
  )
}
