import { t, useTranslation, formatCurrency } from '../../i18n/index.js'
/**
 * Waste stats — a stack screen reached from the dashboard, not a bottom
 * tab (see `docs/superpowers/specs/2026-09-14-waste-stats-design.md`).
 * Answers three questions a foyer member actually asks: how much did we
 * throw away (€ + count) over a period, is it trending down week to week,
 * and how much of what we ate came from an actual recipe rather than
 * habit. Deliberately excludes a category ranking — that's a distinct,
 * separately-scoped stat the design explicitly left out of this pass.
 */
import { useState } from 'react'
import { Image, type ImageSourcePropType } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { Chip } from '../shared/chip.js'
import { PillButton } from '../shared/pill-button.js'
import { Skeleton } from '../shared/skeleton.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { goBack } from '../shared/navigation.js'
import { StatCard } from '../dashboard/stat-card.js'
import { Meter } from '../shared/meter.js'
import { WasteTrendChart } from './waste-trend-chart.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ChefHatIcon, CircleXIcon, SparklesIcon, TrendingUpIcon, WalletIcon } from '../dashboard/dashboard-icons.js'
import { useProductOutcomeStatsQuery } from '../../application/fridge/product-outcome-stats.query.js'

const mascotIllustration = require('../../../assets/mascot.png') as ImageSourcePropType

/** `undefined` days = "Tout", the same convention `getExpiringSoonProducts`'s optional `days` already uses. */
type PeriodOption = { label: string; days: number | undefined; testID: string }

const PERIODS: PeriodOption[] = [
  { get label() { return t('fridge.7_days') }, days: 7, testID: 'stats-period-7' },
  { get label() { return t('fridge.30_days') }, days: 30, testID: 'stats-period-30' },
  { get label() { return t('fridge.all') }, days: undefined, testID: 'stats-period-all' },
]

function formatEuros(value: number): string {
  return formatCurrency(value)
}

function MascotCoachCard({
  consumedCount,
  discardedCount,
  palette,
}: {
  consumedCount: number
  discardedCount: number
  palette: SoftPalette
}) {
  const { t } = useTranslation()
  const isZeroWaste = discardedCount === 0 && consumedCount > 0
  const isGoodRatio = consumedCount >= discardedCount

  const badge = isZeroWaste
    ? t('fridge.star_fridge')
    : isGoodRatio
      ? t('fridge.great_momentum')
      : t('common.rescue_mission')

  const title = isZeroWaste
    ? t('fridge.zero_waste_what_a_talent')
    : isGoodRatio
      ? t('fridge.the_balance_is_tipping_the_right_way')
      : t('fridge.time_for_a_kitchen_rescue')

  const subtitle = isZeroWaste
    ? t('fridge.product_enjoyed_with_no_waste_over_this_period', { count: consumedCount })
    : isGoodRatio
      ? t('fridge.product_saved_discarded_well_done', { count: consumedCount, value2: discardedCount, value3: discardedCount > 1 ? 's' : '' })
      : t('fridge.check_the_suggested_recipes_to_use_your_ingredients_in_time')

  return (
    <XStack
      backgroundColor={palette.cream}
      borderRadius={22}
      padding="$4"
      alignItems="center"
      gap="$3.5"
      style={{
        shadowColor: palette.shadowWarm,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      }}
    >
      <YStack
        width={56}
        height={56}
        borderRadius={18}
        backgroundColor={palette.mintPale}
        alignItems="center"
        justifyContent="center"
      >
        <Image
          source={mascotIllustration}
          style={{ width: 44, height: 44 }}
          resizeMode="contain"
          accessibilityLabel={t('fridge.fridge_mascot')}
        />
      </YStack>

      <YStack flex={1} gap="$1">
        <XStack alignItems="center" gap="$2">
          <XStack
            backgroundColor={palette.freshBg}
            paddingVertical="$0.5"
            paddingHorizontal="$2"
            borderRadius={999}
          >
            <Text fontSize={10} fontWeight="700" color={palette.freshText}>
              {badge}
            </Text>
          </XStack>
        </XStack>
        <Text fontSize={14} fontWeight="800" color={palette.ink}>
          {title}
        </Text>
        <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} lineHeight={16}>
          {subtitle}
        </Text>
      </YStack>
    </XStack>
  )
}

export function StatsScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const [days, setDays] = useState<number | undefined>(30)
  const statsQuery = useProductOutcomeStatsQuery(days)
  const refresh = usePullToRefresh(() => statsQuery.refetch())

  const data = statsQuery.data
  const loading = statsQuery.isPending
  const failed = !loading && statsQuery.isError
  const empty = !loading && !failed && data !== undefined && data.discarded.count === 0 && data.consumed.count === 0

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <TrendingUpIcon size={19} color={color} />}
      title={t('fridge.statistics')}
      onBack={() => goBack('/(tabs)')}
    />
  )

  const recipeShareBadge =
    data && data.recipeSharePercent >= 50
      ? t('common.anti_waste_chef')
      : data && data.recipeSharePercent > 0
        ? t('fridge.recipes_to_the_rescue')
        : t('fridge.try_the_recipes')

  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={header}>
      <YStack marginTop="$5" gap="$5" paddingBottom="$8">
        <XStack gap="$3">
          {PERIODS.map((period) => (
            <Chip
              key={period.testID}
              testID={period.testID}
              label={period.label}
              selected={days === period.days}
              onPress={() => setDays(period.days)}
              palette={palette}
              accessibilityLabel={t('fridge.period', { value1: period.label })}
            />
          ))}
        </XStack>

        {loading ? (
          <YStack gap="$3">
            <Skeleton height={80} radius={22} palette={palette} />
            <XStack gap="$3">
              <Skeleton height={128} width="33%" radius={20} palette={palette} />
              <Skeleton height={128} width="33%" radius={20} palette={palette} />
              <Skeleton height={128} width="33%" radius={20} palette={palette} />
            </XStack>
            <Skeleton height={160} radius={20} palette={palette} />
            <Skeleton height={60} radius={20} palette={palette} />
          </YStack>
        ) : null}

        {failed ? (
          <YStack gap="$3" alignItems="flex-start">
            <Text fontSize={14} fontWeight="500" color={palette.expiredText}>{t('fridge.we_couldn_t_load_the_statistics_check_your_connection')}</Text>
            <PillButton
              testID="stats-retry"
              label={t('dashboard.try_again')}
              accessibilityLabel={t('fridge.try_loading_the_statistics_again')}
              onPress={() => statsQuery.refetch()}
              palette={palette}
            />
          </YStack>
        ) : null}

        {empty ? (
          <YStack
            backgroundColor={palette.cream}
            borderRadius={24}
            padding="$6"
            alignItems="center"
            gap="$3"
            marginTop="$2"
            style={{
              shadowColor: palette.shadowWarm,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 14,
            }}
          >
            <YStack
              width={64}
              height={64}
              borderRadius={22}
              backgroundColor={palette.mintPale}
              alignItems="center"
              justifyContent="center"
            >
              <Image
                source={mascotIllustration}
                style={{ width: 50, height: 50 }}
                resizeMode="contain"
                accessibilityLabel={t('fridge.resting_mascot')}
              />
            </YStack>
            <Text fontSize={16} fontWeight="800" color={palette.ink} textAlign="center">{t('fridge.your_fridge_is_taking_a_nap')}</Text>
            <Text
              testID="stats-empty"
              fontSize={13}
              fontWeight="500"
              color={palette.inkSecondary}
              textAlign="center"
              lineHeight={18}
            >{t('fridge.nothing_to_report_over_this_period_no_products_used_or')}</Text>
          </YStack>
        ) : null}

        {data && !empty ? (
          <>
            <MascotCoachCard
              consumedCount={data.consumed.count}
              discardedCount={data.discarded.count}
              palette={palette}
            />

            <XStack gap="$2.5" alignItems="stretch">
              <StatCard
                testID="stats-consumed-count"
                bg={palette.mintPale}
                labelColor={palette.mintPaleText}
                valueColor={palette.ink}
                chipColor={palette.chipTeal}
                icon={<ChefHatIcon size={18} color={palette.onDark} />}
                label={t('fridge.enjoyed')}
                value={String(data.consumed.count)}
                corner="a"
                palette={palette}
                accessibilityLabel={t('fridge.products_enjoyed', { value1: data.consumed.count })}
              />
              <StatCard
                testID="stats-discarded-count"
                bg={palette.cream}
                labelColor={palette.creamText}
                valueColor={palette.ink}
                chipColor={palette.chipOrange}
                icon={<CircleXIcon size={18} color={palette.onDark} />}
                label={t('fridge.discarded')}
                value={String(data.discarded.count)}
                corner="b"
                palette={palette}
                accessibilityLabel={t('fridge.products_discarded', { value1: data.discarded.count })}
              />
              <StatCard
                testID="stats-discarded-value"
                bg={palette.lavender}
                labelColor={palette.lavenderText}
                valueColor={palette.ink}
                chipColor={palette.chipViolet}
                icon={<WalletIcon size={18} color={palette.onDark} />}
                label={t('fridge.discarded_value')}
                value={formatEuros(data.discarded.value)}
                corner="c"
                palette={palette}
                accessibilityLabel={t('fridge.discarded_value_2', { value1: formatEuros(data.discarded.value) })}
              />
            </XStack>

            <YStack gap="$3" marginTop="$2">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={15} fontWeight="800" color={palette.ink}>{t('fridge.discarded_vs_used')}</Text>
                <Text fontSize={11} fontWeight="600" color={palette.inkSecondary}>{t('fridge.by_week')}</Text>
              </XStack>
              <WasteTrendChart testID="stats-trend-chart" buckets={data.buckets} palette={palette} />
            </YStack>

            <YStack gap="$2.5" marginTop="$2">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={15} fontWeight="800" color={palette.ink}>{t('fridge.recipe_impact')}</Text>
                <XStack
                  alignItems="center"
                  gap="$1"
                  backgroundColor={palette.mintPale}
                  paddingVertical="$0.5"
                  paddingHorizontal="$2"
                  borderRadius={999}
                >
                  <SparklesIcon size={11} color={palette.mintPaleText} />
                  <Text fontSize={10} fontWeight="700" color={palette.mintPaleText}>
                    {recipeShareBadge}
                  </Text>
                </XStack>
              </XStack>
              <Meter
                testID="stats-recipe-share"
                label={t('fridge.meals_cooked_from_a_recipe')}
                percent={data.recipeSharePercent}
                palette={palette}
              />
            </YStack>
          </>
        ) : null}
      </YStack>
    </AppShell>
  )
}
