import { useTranslation } from '../../i18n/index.js'
import { FlatList, Pressable } from 'react-native'
import { router } from 'expo-router'
import { XStack, YStack, Text } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { PillButton } from '../shared/pill-button.js'
import { pullToRefreshControl, usePullToRefresh } from '../shared/pull-to-refresh.js'
import { SkeletonList } from '../shared/skeleton.js'
import { goBack } from '../shared/navigation.js'
import { goToScan } from '../shared/scan-sheet.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ReceiptIcon } from '../dashboard/dashboard-icons.js'
import { useReceiptsQuery } from '../../application/receipt/receipts.query.js'
import type { Receipt } from '../../domain/receipt/receipt.js'

function ReceiptRow({ receipt, palette }: { receipt: Receipt; palette: ReturnType<typeof useSoftPalette> }) {
  const { t } = useTranslation()
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/receipts/[id]', params: { id: receipt.id } })}
      accessibilityRole="button"
      accessibilityLabel={receipt.storeName}
      style={pointerCursor}
    >
      <XStack backgroundColor={palette.gradientBottom} borderRadius={16} padding="$3" marginBottom="$2" justifyContent="space-between">
        <YStack>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            {receipt.storeName}
          </Text>
          <Text fontSize={12} color={palette.inkSecondary}>{t('receipt.item', { value1: receipt.scannedAt.slice(0, 10), count: receipt.itemsCount })}</Text>
        </YStack>
        <Text fontSize={14} fontWeight="700" color={palette.ink}>
          {receipt.totalAmount.toFixed(2)} €
        </Text>
      </XStack>
    </Pressable>
  )
}

// Same pushed-screen convention as settings-screen.tsx: `{ kind: 'stack' }`
// AppShell nav — BackButton in the header, full shell everywhere else. An
// audit found this screen previously had no shell at all.
export function ReceiptsListScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const receipts = useReceiptsQuery()
  const nav = { kind: 'stack' as const }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)
  const refresh = usePullToRefresh(() => receipts.refetch())

  return (
    <AppShell
      nav={nav}
      scrollable={false}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ReceiptIcon size={19} color={color} />}
          title={t('receipt.receipt_history')}
          onBack={() => goBack('/settings')}
        />
      }
    >
      <FlatList
        data={receipts.data ?? []}
        keyExtractor={(receipt) => receipt.id}
        renderItem={({ item }) => <ReceiptRow receipt={item} palette={palette} />}
        contentContainerStyle={shellContentStyle({ isWide, hasMobileNav })}
        showsVerticalScrollIndicator={false}
        refreshControl={pullToRefreshControl(refresh, palette)}
        ListEmptyComponent={
          receipts.isPending ? (
            <SkeletonList rows={5} label={t('receipt.loading_receipts')} palette={palette} />
          ) : receipts.isError ? (
            // Before the empty branch: a failed read used to render "Aucun
            // ticket importé", which tells a foyer its history is empty when
            // it is only unreachable — and then offers the scanner, which
            // cannot save either.
            <YStack alignItems="center" gap="$3" marginTop="$8">
              <ReceiptIcon size={32} color={palette.expiredText} />
              <Text fontSize={15} fontWeight="700" color={palette.ink}>{t('receipt.receipts_unavailable')}</Text>
              <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">{t('receipt.we_couldn_t_load_the_household_s_receipt_history_check')}</Text>
              <PillButton
                testID="receipts-retry"
                label={t('dashboard.try_again')}
                accessibilityLabel={t('receipt.try_loading_receipts_again')}
                onPress={() => receipts.refetch()}
                palette={palette}
              />
            </YStack>
          ) : receipts.data?.length === 0 ? (
            // Not a bare sentence: this screen is now reachable in one tap from
            // the dashboard, so an empty history is somewhere a person lands
            // rather than somewhere they only arrive by accident. The one thing
            // that fills it has to be here.
            <YStack alignItems="center" gap="$3" marginTop="$8">
              <ReceiptIcon size={32} color={palette.inkSecondary} />
              <Text fontSize={15} fontWeight="700" color={palette.ink}>{t('receipt.no_receipts_yet')}</Text>
              <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">{t('receipt.scan_a_receipt_to_fill_your_pantry_in_one_go')}</Text>
              <PillButton
                testID="receipts-empty-scan"
                label={t('dashboard.scan')}
                onPress={goToScan}
                palette={palette}
              />
            </YStack>
          ) : null
        }
      />
    </AppShell>
  )
}
