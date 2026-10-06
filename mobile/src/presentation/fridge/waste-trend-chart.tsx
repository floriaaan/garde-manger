import { useTranslation, getLocale } from '../../i18n/index.js'
/**
 * Six grouped bar-pairs — jeté vs consommé, one pair per bucket the backend
 * hands back (`GetProductOutcomeStats.BUCKET_COUNT`). Two time series,
 * both counts, both categorical over time: the dataviz skill's own form
 * heuristic calls that a grouped bar chart, never a line (no continuous
 * trend claim over sparse weekly counts) and never dual-axis (one shared
 * count scale for both series).
 *
 * Hand-rolled with Tamagui `View`/`YStack` — no `react-native-svg` needed
 * for a bar chart, and no chart library exists in this app (see
 * `docs/superpowers/specs/2026-09-14-waste-stats-design.md`).
 *
 * Colors reuse DESIGN.md's existing semantic tokens rather than a fresh
 * categorical palette: jeté ↔ `expired`, consommé ↔ `fresh` are the same
 * "loss" / "good" concepts those tokens already carry everywhere else in
 * the app (the status chips, the dashboard hero pills), not a generic
 * categorical-token reuse.
 */
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import type { OutcomeBucket } from '../../domain/fridge/product-outcome-stats.js'

/** The tallest a bar is allowed to draw — the rest is proportional to it. */
const MAX_BAR_HEIGHT = 96
/** ≤24px per the dataviz skill's mark spec; 2px gap between a pair's two bars. */
const BAR_WIDTH = 20
const BAR_GAP = 2

function bucketDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
}

export function WasteTrendChart({
  testID,
  buckets,
  palette,
}: {
  testID?: string
  buckets: OutcomeBucket[]
  palette: SoftPalette
}) {
  const { t } = useTranslation()
  const maxCount = Math.max(1, ...buckets.map((b) => Math.max(b.discardedCount, b.consumedCount)))

  return (
    <YStack testID={testID} gap="$4">
      <XStack justifyContent="space-between" alignItems="flex-end" style={{ height: MAX_BAR_HEIGHT }}>
        {buckets.map((bucket, index) => {
          const discardedHeight = Math.round((bucket.discardedCount / maxCount) * MAX_BAR_HEIGHT)
          const consumedHeight = Math.round((bucket.consumedCount / maxCount) * MAX_BAR_HEIGHT)
          const total = bucket.discardedCount + bucket.consumedCount
          return (
            <YStack
              key={`${bucket.from}-${index}`}
              alignItems="center"
              gap="$1.5"
              accessible
              accessibilityLabel={
                total === 0
                  ? t('fridge.week_of_nothing_to_report', { value1: bucketDateLabel(bucket.from) })
                  : t('fridge.week_of_discarded_used', { value1: bucketDateLabel(bucket.from), count: bucket.discardedCount, value3: bucket.consumedCount, value4: bucket.consumedCount > 1 ? 's' : '' })
              }
            >
              <XStack alignItems="flex-end" gap={BAR_GAP} height={MAX_BAR_HEIGHT}>
                <YStack
                  width={BAR_WIDTH}
                  height={Math.max(discardedHeight, 2)}
                  backgroundColor={palette.expired}
                  style={{ borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
                />
                <YStack
                  width={BAR_WIDTH}
                  height={Math.max(consumedHeight, 2)}
                  backgroundColor={palette.fresh}
                  style={{ borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
                />
              </XStack>
              <Text fontSize={9} fontWeight="500" color={palette.inkSecondary}>
                {bucketDateLabel(bucket.from)}
              </Text>
            </YStack>
          )
        })}
      </XStack>

      {/* Legend — mandatory for ≥2 series, per the dataviz skill: identity
          must never rest on color alone, so each swatch carries a label. */}
      <XStack gap="$4">
        <XStack alignItems="center" gap="$1.5">
          <YStack width={10} height={10} borderRadius={3} backgroundColor={palette.expired} />
          <Text fontSize={12} fontWeight="600" color={palette.expiredText}>{t('fridge.discarded_2')}</Text>
        </XStack>
        <XStack alignItems="center" gap="$1.5">
          <YStack width={10} height={10} borderRadius={3} backgroundColor={palette.fresh} />
          <Text fontSize={12} fontWeight="600" color={palette.freshText}>{t('fridge.used_2')}</Text>
        </XStack>
      </XStack>
    </YStack>
  )
}
