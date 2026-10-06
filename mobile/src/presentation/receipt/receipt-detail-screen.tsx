import { useTranslation } from '../../i18n/index.js'
import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { goBack } from '../shared/navigation.js'
import { pointerCursor } from '../shared/hover.js'
import { ChevronRightIcon, ReceiptIcon, StoreIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReceiptQuery } from '../../application/receipt/receipt.query.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { SkeletonGroup, SkeletonRow, Skeleton } from '../shared/skeleton.js'

export function ReceiptDetailScreen({ receiptId }: { receiptId: string }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const query = useReceiptQuery(receiptId)
  const refresh = usePullToRefresh(() => query.refetch())

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <ReceiptIcon size={19} color={color} />}
      title={t('receipt.receipt')}
      onBack={() => goBack('/receipts')}
    />
  )

  // Was `return null`: a blank white screen with no chrome, no back button
  // and nothing for a screen reader to announce, for the whole load.
  if (query.isPending) {
    return (
      <AppShell nav={{ kind: 'stack' }} header={header}>
        {/* The shape of the ticket that is coming — a total, then its rows —
            so the layout does not jump under the thumb when it lands. */}
        <SkeletonGroup label={t('receipt.loading_receipt')}>
          <Skeleton width="46%" height={18} />
          <Skeleton width="30%" height={12} />
          <YStack marginTop="$4" gap="$1">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </YStack>
        </SkeletonGroup>
      </AppShell>
    )
  }

  if (!query.data) {
    return (
      <AppShell nav={{ kind: 'stack' }} header={header}>
        <YStack alignItems="center" justifyContent="center" marginTop="$8">
          <Text fontSize={14} color={palette.ink}>{t('receipt.receipt_not_found')}</Text>
        </YStack>
      </AppShell>
    )
  }

  const { receipt, products } = query.data

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <StoreIcon size={19} color={color} />}
          title={receipt.storeName}
          subtitle={`${receipt.scannedAt.slice(0, 10)} · ${receipt.totalAmount.toFixed(2)} €`}
          onBack={() => goBack('/receipts')}
        />
      }
    >
      <YStack marginTop="$4" gap="$2">
        <Text fontSize={13} fontWeight="700" color={palette.inkSecondary}>{t('receipt.product_imported', { count: products.length })}</Text>
        {/* These rows used to be inert: the ticket listed the products it
            created with no route back to any of them. */}
        {products.map((product) => (
          <Pressable
            key={product.id}
            testID={`receipt-product-${product.id}`}
            onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]', params: { id: product.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${product.name}, ${product.quantity.amount} ${product.quantity.unit}`}
            style={pointerCursor}
          >
            <XStack backgroundColor={palette.mintPale} borderRadius={16} padding="$3" minHeight={52} alignItems="center" gap="$3">
              <Text fontSize={14} fontWeight="700" color={palette.mintPaleText} flex={1}>
                {product.name}
              </Text>
              <Text fontSize={13} color={palette.mintPaleText}>
                {product.quantity.amount} {product.quantity.unit}
              </Text>
              <ChevronRightIcon size={16} color={palette.mintPaleText} />
            </XStack>
          </Pressable>
        ))}
      </YStack>
    </AppShell>
  )
}
