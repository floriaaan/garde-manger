/**
 * A single ratio against 100% — the recipe-share meter on `StatsScreen`
 * ("part des produits consommés cuisinés en recette"). One measure, one
 * bar: a `Meter`, not a chart — per the dataviz skill's form heuristic, a
 * lone percentage against its ceiling has no second series to compare
 * against and no time axis, so a bar-with-legend would be the two-series
 * grouped-bar shape (`WasteTrendChart`'s own job) applied to one number.
 *
 * Fill from `fresh`/`freshText` — the ratio is "good behaviour" (cooked
 * from what was in the garde-manger rather than thrown out), which is
 * exactly the existing "fresh" concept DESIGN.md's semantic tokens already
 * carry, not a generic accent borrowed for a fourth meaning.
 */
import { Text, XStack, YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function Meter({
  testID,
  label,
  percent,
  palette,
}: {
  testID?: string
  label: string
  /** 0–100. Clamped, so a rounding edge case never draws past the track. */
  percent: number
  palette: SoftPalette
}) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <YStack testID={testID} gap="$2">
      <XStack justifyContent="space-between" alignItems="baseline">
        <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>
          {label}
        </Text>
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          {Math.round(clamped)}%
        </Text>
      </XStack>
      <YStack
        height={12}
        borderRadius={999}
        backgroundColor={palette.freshBg}
        overflow="hidden"
        role="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
        accessibilityLabel={`${label} : ${Math.round(clamped)}%`}
      >
        <YStack height={12} width={`${clamped}%`} borderRadius={999} backgroundColor={palette.fresh} />
      </YStack>
    </YStack>
  )
}
