import { t } from '../../i18n/index.js'
import { CircleCheckIcon, CircleXIcon, TriangleAlertIcon } from './dashboard-icons.js'
import { Text, XStack } from '../shared/tamagui-typed.js'
import type { ProductStatus } from './product-status.js'

function StatusIcon({ status, size, color }: { status: ProductStatus; size: number; color: string }) {
  if (status === 'expired') return <CircleXIcon size={size} color={color} />
  if (status === 'soon') return <TriangleAlertIcon size={size} color={color} />
  return <CircleCheckIcon size={size} color={color} />
}

function statusLabel(status: ProductStatus): string {
  return status === 'expired' ? t('dashboard.past_expiry_2') : status === 'soon' ? t('dashboard.first') : t('dashboard.fresh')
}

/** A small colored pill carrying the product's status as icon + word, not color alone. */
export function StatusChip({ status, bg, color }: { status: ProductStatus; bg: string; color: string }) {
  return (
    <XStack alignItems="center" gap="$1" backgroundColor={bg} borderRadius={999} paddingVertical="$0.5" paddingHorizontal="$2">
      <StatusIcon status={status} size={11} color={color} />
      <Text fontSize={10} fontWeight="700" color={color}>
        {statusLabel(status)}
      </Text>
    </XStack>
  )
}
