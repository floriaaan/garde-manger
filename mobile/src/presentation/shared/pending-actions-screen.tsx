import { FlatList } from 'react-native'
import { router } from 'expo-router'
import { useQueuedActions } from '../../application/sync/mutation-queue-context.js'
import { isFakeConnector } from '../../application/shared/connector-mode.js'
import type { QueuedMutation } from '../../application/sync/mutation-queue.js'
import { formatCurrency, getLocale, useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ClockIcon, TrashIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { AppShell, shellContentStyle, useAppShellLayout } from './app-shell.js'
import { ScreenHeader } from './screen-header.js'
import { Pressable } from './pressable.js'
import { PillButton } from './pill-button.js'
import { Text, XStack, YStack } from './tamagui-typed.js'

function ActionRow({ entry }: { entry: QueuedMutation }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const Icon = entry.patch === null ? TrashIcon : ClockIcon
  const status = entry.error ? 'blocked' : entry.attempts > 0 ? 'retrying' : 'waiting'
  const fields = Object.entries(entry.patch ?? {}).filter(([field]) => field !== 'expectedUpdatedAt')
  function valueLabel(field: string, value: unknown): string {
    if (value === null) return t('sync.cleared')
    if (field === 'checked') return t(value ? 'sync.checked' : 'sync.unchecked')
    if (field === 'quantity') {
      const quantity = value as { amount: number; unit: string }
      return `${new Intl.NumberFormat(getLocale()).format(quantity.amount)} ${quantity.unit}`
    }
    if (field === 'location') return t(`fridge.${value}`)
    if (field === 'price') return formatCurrency(value as number)
    if (field === 'expiresAt' || field === 'openedAt') {
      return new Date(value as string).toLocaleDateString(getLocale(), { timeZone: 'UTC' })
    }
    return Array.isArray(value) ? value.length ? value.join(', ') : t('sync.cleared') : String(value)
  }
  return (
    <XStack paddingVertical="$4" gap="$3" alignItems="flex-start" testID={`queued-action-${entry.id}`}>
      <YStack paddingTop="$1" accessible={false} aria-hidden>
        <Icon size={20} color={palette.inkSecondary} />
      </YStack>
      <YStack flex={1} minWidth={0} gap="$1.5">
        <Text fontSize={16} fontWeight="800" color={palette.ink}>{entry.base.name}</Text>
        <Text fontSize={13} color={palette.inkSecondary}>
          {t(entry.collection === 'products' ? 'sync.products' : 'sync.shopping')} · {t(entry.patch === null ? 'sync.delete' : 'sync.edit')}
        </Text>
        {fields.map(([field, value]) => (
          <Text key={field} fontSize={14} color={palette.ink}>
            {t(`sync.fields.${field}`)} : {valueLabel(field, value)}
          </Text>
        ))}
        <Text fontSize={13} fontWeight="600" color={entry.error ? palette.expiredText : palette.soonText}>
          {t(`sync.${status}`)}
        </Text>
        {entry.error ? <Text fontSize={13} color={palette.inkSecondary}>{t(
          entry.error.type === 'sync_conflict' ? 'sync.conflict'
            : ['product_not_found', 'shopping_item_not_found'].includes(entry.error.type) ? 'sync.deleted' : 'sync.refused',
        )}</Text> : null}
      </YStack>
    </XStack>
  )
}

export function PendingActionsScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const actions = useQueuedActions()
  const layout = useAppShellLayout({ kind: 'modal' })
  const entries = actions.data ?? []
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/') }
  return (
    <AppShell nav={{ kind: 'modal' }} scrollable={false} header={
      <ScreenHeader palette={palette} icon={(color) => <ClockIcon size={19} color={color} />}
        title={t('sync.title')} subtitle={actions.isSuccess ? t('sync.count', { count: entries.length }) : undefined}
        trailing={<Pressable accessibilityRole="button" accessibilityLabel={t('shared.close')}
          onPress={close} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24,
            alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cream, opacity: pressed ? 0.7 : 1 })}>
          <XIcon size={20} color={palette.ink} />
        </Pressable>} />
    }>
      <FlatList data={entries} keyExtractor={(entry) => String(entry.id)}
        contentContainerStyle={shellContentStyle(layout)}
        ListHeaderComponent={<Text fontSize={14} lineHeight={21} color={palette.inkSecondary} marginBottom="$3">
          {t(isFakeConnector ? 'sync.demo_description' : 'sync.description')}
        </Text>}
        ItemSeparatorComponent={() => <YStack height={1} backgroundColor={palette.creamPillEdge} />}
        renderItem={({ item }) => <ActionRow entry={item} />}
        ListEmptyComponent={<YStack paddingVertical="$6" gap="$3" alignItems="center">
          <Text fontSize={16} fontWeight="700" textAlign="center" color={palette.ink}>
            {t(actions.isPending ? 'sync.loading' : actions.isError ? 'sync.load_error' : 'sync.empty')}
          </Text>
          {!actions.isPending && !actions.isError ? <Text fontSize={14} textAlign="center" color={palette.inkSecondary}>
            {t('sync.empty_description')}
          </Text> : null}
          {actions.isError ? <PillButton palette={palette} label={t('dashboard.try_again')}
            onPress={() => { void actions.refetch() }} centered /> : null}
        </YStack>} />
    </AppShell>
  )
}
