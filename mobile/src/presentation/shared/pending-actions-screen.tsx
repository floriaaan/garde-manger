import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ActivityIndicator, Animated, FlatList } from 'react-native'
import { router } from 'expo-router'
import { showToast } from '../../application/shared/toast.js'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { isFakeConnector } from '../../application/shared/connector-mode.js'
import { useQueuedActions } from '../../application/sync/mutation-queue-context.js'
import type { QueuedMutation } from '../../application/sync/mutation-queue.js'
import { formatCurrency, getLocale, t as translate, useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ArrowRightIcon, ArrowLeftRightIcon, CalendarIcon, CheckIcon, ClockIcon, LayersIcon, PencilIcon, RefreshIcon, ScaleIcon, SmartphoneCheckIcon, TagIcon, TrashIcon, TriangleAlertIcon, WalletIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { IdentityCard } from '../settings/identity-card.js'
import { AppShell, shellContentStyle, useAppShellLayout } from './app-shell.js'
import { ActionSheet } from './action-sheet.js'
import { Chip } from './chip.js'
import { ScreenHeader } from './screen-header.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { ripple, rippleClip } from './material.js'
import { SkeletonList } from './skeleton.js'
import { Pressable } from './pressable.js'
import { ProgressBar } from './progress-bar.js'
import { PillButton } from './pill-button.js'
import { Text, XStack, YStack } from './tamagui-typed.js'

type Filter = 'all' | 'pending' | 'failed'

function valueLabel(field: string, value: unknown, before = false): string {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0))
    return translate(before ? 'sync.not_set' : 'sync.cleared')
  if (field === 'checked') return translate(value ? 'sync.checked' : 'sync.unchecked')
  if (field === 'quantity') {
    const quantity = value as { amount: number; unit: string }
    return `${new Intl.NumberFormat(getLocale()).format(quantity.amount)} ${quantity.unit}`
  }
  if (field === 'location') return translate(`fridge.${value}`)
  if (field === 'price') return formatCurrency(value as number)
  if (field === 'expiresAt' || field === 'openedAt')
    return new Date(value as string).toLocaleDateString(getLocale(), { timeZone: 'UTC' })
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function ActionRow({ entry, index, onCancel, cancelling, disabled, onRetry, retryDisabled, retrying, onOverwrite, sending }: { entry: QueuedMutation; index: number;
  onCancel: () => void; cancelling: boolean; disabled: boolean; onRetry: () => void; retryDisabled: boolean; retrying: boolean; onOverwrite: () => void; sending: boolean }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const secondaryInk = palette.creamText
  const fields = Object.entries(entry.patch ?? {}).filter(([field]) => field !== 'expectedUpdatedAt')
  const status = t(entry.error ? 'sync.attention' : sending ? 'shared.network_syncing' : entry.attempts > 0 ? 'sync.retrying' : 'sync.to_send')
  const StatusIcon = entry.error ? TriangleAlertIcon : sending || entry.attempts > 0 ? RefreshIcon : ClockIcon
  const statusColor = entry.error ? palette.expiredText : palette.soonText
  const statusBackground = entry.error ? palette.expiredBg : palette.soonBg
  const field = fields.length === 1 ? fields[0][0] : undefined
  const ActionIcon = entry.patch === null ? TrashIcon : field === 'quantity' ? ScaleIcon
    : field === 'location' ? ArrowLeftRightIcon : field === 'price' ? WalletIcon
      : field === 'checked' ? CheckIcon : field === 'expiresAt' || field === 'openedAt' ? CalendarIcon
        : field === 'categories' ? TagIcon : PencilIcon
  return (
    <IdentityCard testID={`queued-action-${entry.id}`} palette={palette}
      bg={palette.cream} labelColor={secondaryInk} subtleShadow
      chipColor={palette.creamPill}
      icon={<ActionIcon size={20} color={palette.ink} />} corner={index % 2 === 0 ? 'a' : 'b'}
      label={entry.base.name} value={t(entry.collection === 'products' ? 'sync.products' : 'sync.shopping')}
      emphasizeLabel footer={
        <YStack gap="$4">
          {fields.map(([field, value]) => {
            const oldValue = valueLabel(field, (entry.base as unknown as Record<string, unknown>)[field], true)
            const newValue = valueLabel(field, value)
            const label = t(`sync.fields.${field}`)
            return (
              <YStack key={field} gap="$2" accessible
                accessibilityLabel={t('sync.change_description', { field: label, before: oldValue, after: newValue })}>
                <Text fontSize={13} fontWeight="700" color={palette.ink}>{label}</Text>
                <XStack alignItems="center" gap="$3">
                  <YStack flex={1} minWidth={0} gap="$1">
                    <Text fontSize={12} fontWeight="600" color={secondaryInk}>{t('sync.before')}</Text>
                    <Text fontSize={14} lineHeight={20} fontWeight="500" color={secondaryInk}>{oldValue}</Text>
                  </YStack>
                  <YStack flexShrink={0} accessible={false} aria-hidden>
                    <ArrowRightIcon size={18} color={secondaryInk} />
                  </YStack>
                  <YStack flex={1} minWidth={0} gap="$1">
                    <Text fontSize={12} fontWeight="600" color={secondaryInk}>{t('sync.your_change')}</Text>
                    <Text fontSize={20} lineHeight={26} fontWeight="800" color={palette.ink}>{newValue}</Text>
                  </YStack>
                </XStack>
              </YStack>
            )
          })}
          {entry.patch === null ? <Text fontSize={14} lineHeight={21} fontWeight="600" color={palette.ink}>
            {t(entry.collection === 'products' ? 'sync.remove_product' : 'sync.remove_shopping')}
          </Text> : null}
          <YStack gap="$2">
            <XStack alignItems="center" gap="$1.5" alignSelf="flex-start" paddingHorizontal="$2" paddingVertical="$1"
              borderRadius={999} backgroundColor={statusBackground}>
              <YStack accessible={false} aria-hidden><StatusIcon size={13} color={statusColor} /></YStack>
              <Text flexShrink={1} fontSize={12} fontWeight="600" color={statusColor}>{status}</Text>
            </XStack>
            {entry.error ? <Text fontSize={13} lineHeight={20} color={palette.expiredText}>{t(
              entry.error.type === 'sync_conflict' ? 'sync.conflict'
                : ['product_not_found', 'shopping_item_not_found'].includes(entry.error.type) ? 'sync.deleted' : 'sync.refused',
            )}</Text> : null}
          </YStack>
          <ProgressBar testID={`queued-progress-${entry.id}`} palette={{ ...palette, fresh: palette.freshText }}
            value={sending ? undefined : 0} total={sending ? undefined : 1}
            label={t('sync.item_progress', { name: entry.base.name })} />
          <XStack gap="$3" flexWrap="wrap" alignItems="center" paddingVertical="$2">
            {entry.error?.type === 'sync_conflict' ? <PillButton testID={`queued-overwrite-${entry.id}`}
              label={t('sync.overwrite')} accessibilityLabel={t('sync.overwrite_named', { name: entry.base.name })}
              palette={{ ...palette, cream: palette.creamPill }} tone="quiet" creamSurfaceEdge size="dense"
              disabled={retryDisabled} busy={retrying} onPress={onOverwrite}
              icon={(color) => <RefreshIcon size={13} color={color} />} /> : null}
            {(entry.error && !['sync_conflict', 'product_not_found', 'shopping_item_not_found', 'unauthenticated'].includes(entry.error.type)) || (!entry.error && entry.attempts > 0) ?
              <PillButton testID={`queued-retry-${entry.id}`} label={t('sync.retry')} size="dense"
                accessibilityLabel={t('sync.retry_item', { name: entry.base.name })}
                palette={{ ...palette, cream: palette.creamPill }} tone="quiet" creamSurfaceEdge
                disabled={retryDisabled} busy={retrying} onPress={onRetry}
                icon={(color) => <RefreshIcon size={15} color={color} />} /> : null}
            <PillButton testID={`queued-cancel-${entry.id}`} label={t('sync.cancel')} size="dense"
              accessibilityLabel={t('sync.cancel_named', { name: entry.base.name })}
              palette={{ ...palette, cream: palette.creamPill }} tone="quiet" creamSurfaceEdge onPress={onCancel}
              disabled={disabled} busy={cancelling} icon={(color) => cancelling
                ? <ActivityIndicator size="small" color={color} /> : <XIcon size={13} color={color} />} />
          </XStack>
        </YStack>
      } />
  )
}

export function PendingActionsScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const closeHover = useHoverPress()
  const actions = useQueuedActions()
  const online = useConnectivity(isFakeConnector)
  const retry = useMutation({ mutationFn: ({ id, overwrite }: { id: number; overwrite?: boolean }) => overwrite ? actions.overwrite(id) : actions.retry(id), networkMode: 'always',
    onError: () => showToast(t('sync.retry_error'), 'error') })
  const retryDisabled = online === false || actions.status.syncing || actions.status.storageUnavailable || retry.isPending
  const [selected, setSelected] = useState<QueuedMutation | null>(null)
  const cancellation = useMutation({
    mutationFn: actions.cancel, networkMode: 'always',
    onSuccess: (result) => {
      if (!result.ok) showToast(t(['action_unavailable', 'action_syncing', 'storage_error', 'cache_update_error'].includes(result.error.type)
        ? `sync.cancel_${result.error.type}` : 'sync.cancel_error'), 'error')
    },
    onError: () => showToast(t('sync.cancel_error'), 'error'),
  })
  const layout = useAppShellLayout({ kind: 'modal' })
  const [filter, setFilter] = useState<Filter>('all')
  const list = useRef<FlatList<QueuedMutation>>(null)
  const entries = actions.data ?? []
  const pending = entries.filter((entry) => !entry.error)
  const failed = entries.filter((entry) => entry.error)
  const visible = filter === 'pending' ? pending : filter === 'failed' ? failed : entries
  const filters: { id: Filter; label: string; count: number; icon: typeof ClockIcon }[] = [
    { id: 'all', label: t('sync.all'), count: entries.length, icon: LayersIcon },
    { id: 'pending', label: t('sync.to_send'), count: pending.length, icon: ClockIcon },
    { id: 'failed', label: t('sync.attention'), count: failed.length, icon: TriangleAlertIcon },
  ]
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/') }
  return (
    <>
    <AppShell nav={{ kind: 'modal' }} scrollable={false} header={
      <YStack gap="$3">
        <ScreenHeader palette={palette}
          icon={(color) => <ClockIcon size={20} color={color} />}
          title={t('sync.title')} subtitle={actions.data !== undefined ? t('sync.count', { count: entries.length }) : undefined}
          trailing={
            <Animated.View style={{ transform: [{ scale: closeHover.scale }] }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('shared.close')} onPress={close}
                onHoverIn={closeHover.onHoverIn} onHoverOut={closeHover.onHoverOut}
                onPressIn={closeHover.onPressIn} onPressOut={closeHover.onPressOut}
                android_ripple={ripple(palette.ink)}
                style={[pointerCursor, rippleClip(999), { width: 48, height: 48, borderRadius: 999,
                  backgroundColor: palette.cream, alignItems: 'center', justifyContent: 'center' }]}>
                <XIcon size={22} color={palette.ink} />
              </Pressable>
            </Animated.View>
          } />
        {entries.length > 0 ? <XStack gap="$2.5" alignItems="center" paddingTop="$1" paddingBottom="$1">
          <YStack flexShrink={0} accessible={false} aria-hidden><SmartphoneCheckIcon size={25} color={palette.ink} /></YStack>
          <Text flex={1} minWidth={0} fontSize={14} lineHeight={20} fontWeight="600" color={palette.ink}>{t('sync.on_device')}</Text>
        </XStack> : null}
        {actions.status.progress.total > 0 ? <YStack gap="$2">
          <Text fontSize={13} fontWeight="600" color={palette.ink} accessibilityLiveRegion="polite">
            {t('sync.global_progress', { done: actions.status.progress.done, total: actions.status.progress.total })}
          </Text>
          <ProgressBar testID="queued-global-progress" palette={{ ...palette, fresh: palette.freshText }}
            value={actions.status.progress.done} total={actions.status.progress.total} label={t('sync.progress')} />
        </YStack> : null}
      </YStack>
    }>
      <YStack flex={1} minHeight={0}>
        <XStack gap="$3" flexWrap="wrap" style={{ ...shellContentStyle(layout), paddingTop: 20, paddingBottom: 20 }}
          accessibilityLabel={t('sync.filter_label')}>
          {filters.map((option) => <Chip key={option.id} testID={`queued-filter-${option.id}`}
            label={`${option.label}${actions.data !== undefined ? ` ${option.count}` : ''}`}
            selected={filter === option.id} palette={palette} icon={(color) => <option.icon size={13} color={color} />}
            onPress={() => { setFilter(option.id); list.current?.scrollToOffset({ offset: 0, animated: false }) }} />)}
        </XStack>
        <FlatList ref={list} data={visible} keyExtractor={(entry) =>
          `${entry.scope.server}:${entry.scope.userId}:${entry.scope.householdId}:${entry.id}`}
          contentContainerStyle={{ ...shellContentStyle(layout), paddingTop: 0, flexGrow: 1 }}
          ListHeaderComponent={entries.length > 0 && pending.length === 0 ? <Text fontSize={13} lineHeight={19}
            color={palette.inkSecondary} marginBottom="$2">{t('sync.needs_attention')}</Text> : null}
          ItemSeparatorComponent={() => <YStack height={24} />}
          renderItem={({ item, index }) => <ActionRow entry={item} index={index}
            onCancel={() => setSelected(item)} disabled={cancellation.isPending || retry.isPending}
            onRetry={() => { if (!retryDisabled) retry.mutate({ id: item.id }) }} retryDisabled={retryDisabled || cancellation.isPending}
            onOverwrite={() => { if (!retryDisabled && !cancellation.isPending) retry.mutate({ id: item.id, overwrite: true }) }}
            sending={actions.status.sendingId === item.id}
            retrying={retry.isPending && retry.variables?.id === item.id}
            cancelling={cancellation.isPending && cancellation.variables === item.id} />}
          ListEmptyComponent={<YStack paddingVertical="$6" paddingHorizontal="$2" gap="$3" alignItems="center">
            {actions.isPending ? <SkeletonList palette={palette} rows={3} label={t('sync.loading')} /> : <Text fontSize={16} fontWeight="700" textAlign="center" color={palette.ink}>
              {t(actions.isError ? 'sync.load_error'
                : filter === 'pending' ? 'sync.empty_pending' : filter === 'failed' ? 'sync.empty_failed' : 'sync.empty')}
            </Text>}
            {!actions.isPending && !actions.isError && entries.length === 0 ? <Text fontSize={14} lineHeight={21}
              textAlign="center" color={palette.inkSecondary}>{t('sync.empty_description')}</Text> : null}
            {actions.isError ? <PillButton palette={palette} label={t('dashboard.try_again')}
              onPress={() => { void actions.refetch() }} centered /> : null}
          </YStack>} />
      </YStack>
    </AppShell>
    <ActionSheet visible={selected !== null} onClose={() => setSelected(null)}
      title={selected ? t('sync.cancel_named', { name: selected.base.name }) : undefined}
      description={t(selected && selected.attempts > 0 ? 'sync.cancel_retry_description' : 'sync.cancel_description')}
      closeLabel={t('sync.keep')} options={[{
        testID: 'queued-cancel-confirm', label: t('sync.cancel_confirm'), destructive: true,
        tint: palette.expired, icon: (color) => <XIcon size={18} color={color} />,
        onPress: () => { if (selected) { cancellation.mutate(selected.id); setSelected(null) } },
      }]} />
    </>
  )
}
