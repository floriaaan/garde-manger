import { useCallback, useRef, useState } from 'react'
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
import { SyncCompletion } from './sync-completion.js'
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

function ActionRow({ entry, index, onCancel, cancelling, disabled, onRetry, retryDisabled, retrying, onOverwrite, sending, connected }: { entry: QueuedMutation; index: number;
  onCancel: () => void; cancelling: boolean; disabled: boolean; onRetry: () => void; retryDisabled: boolean; retrying: boolean; onOverwrite: () => void; sending: boolean; connected: boolean }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const secondaryInk = palette.creamText
  const fields = Object.entries(entry.patch ?? {}).filter(([field]) => field !== 'expectedUpdatedAt')
  const status = t(sending ? 'shared.network_syncing' : entry.error ? 'sync.attention' : entry.attempts > 0 ? 'sync.retrying' : 'sync.to_send')
  const StatusIcon = sending ? RefreshIcon : entry.error ? TriangleAlertIcon : entry.attempts > 0 ? RefreshIcon : ClockIcon
  const statusColor = entry.error && !sending ? palette.expiredText : palette.soonText
  const statusBackground = entry.error && !sending ? palette.expiredBg : palette.soonBg
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
                : ['product_not_found', 'shopping_item_not_found'].includes(entry.error.type) ? 'sync.deleted'
                : entry.error.type === 'unauthenticated' ? 'sync.session_expired' : 'sync.refused',
            )}</Text> : null}
          </YStack>
          {sending ? <ProgressBar testID={`queued-progress-${entry.id}`} palette={{ ...palette, fresh: palette.freshText }}
            label={t('sync.item_progress', { name: entry.base.name })} /> : null}
          <XStack gap="$3" flexWrap="wrap" alignItems="center" paddingVertical="$2">
            {connected && entry.error?.type === 'sync_conflict' ? <PillButton testID={`queued-overwrite-${entry.id}`}
              label={t('sync.overwrite')} accessibilityLabel={t('sync.overwrite_named', { name: entry.base.name })}
              palette={{ ...palette, cream: palette.creamPill }} tone="quiet" creamSurfaceEdge size="dense"
              disabled={retryDisabled} busy={retrying} onPress={onOverwrite}
              icon={(color) => <RefreshIcon size={13} color={color} />} /> : null}
            {(entry.error && !['sync_conflict', 'product_not_found', 'shopping_item_not_found'].includes(entry.error.type)) || (!entry.error && entry.attempts > 0) ?
              <PillButton testID={`queued-retry-${entry.id}`} label={t(entry.error?.type === 'unauthenticated' ? 'sync.reconnect' : 'sync.retry')} size="dense"
                accessibilityLabel={entry.error?.type === 'unauthenticated' ? t('sync.reconnect') : t('sync.retry_item', { name: entry.base.name })}
                palette={{ ...palette, cream: palette.creamPill }} tone="quiet" creamSurfaceEdge
                disabled={retryDisabled} busy={retrying} onPress={onRetry}
                icon={(color) => <RefreshIcon size={15} color={color} />} /> : null}
            <PillButton testID={`queued-cancel-${entry.id}`} label={t('sync.cancel')} size="dense"
              accessibilityLabel={t('sync.cancel_named', { name: entry.base.name })}
              palette={{ ...palette, cream: palette.creamPill }} tone="quiet" creamSurfaceEdge onPress={onCancel}
              disabled={disabled || sending} busy={cancelling} icon={(color) => cancelling
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
  const [review, setReview] = useState<QueuedMutation | null>(null)
  const preview = useMutation({ mutationFn: actions.previewConflict, networkMode: 'always' })
  const recoveryMessage = (error: unknown, fallback = 'sync.retry_error') => t(error instanceof Error && ['sync.overwrite_changed', 'sync.overwrite_unavailable', 'sync.deleted', 'sync.session_check_error'].includes(error.message) ? error.message : fallback)
  const retry = useMutation({ mutationFn: async ({ id, reviewedUpdatedAt, reconnect }: { id: number; reviewedUpdatedAt?: string; reconnect?: boolean }) => {
    if (reconnect) { if (!await actions.reconnect(id)) router.replace('/(auth)/sign-in') }
    else if (reviewedUpdatedAt !== undefined) await actions.overwrite(id, reviewedUpdatedAt)
    else await actions.retry(id)
  }, networkMode: 'always', onError: (error) => showToast(recoveryMessage(error), 'error') })
  const retryDisabled = online !== true || actions.status.syncing || actions.status.storageUnavailable || retry.isPending || preview.isPending
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
  const reviewEntry = review && JSON.stringify([review.scope.server, review.scope.userId, review.scope.householdId]) === actions.scopeKey ? review : null
  const selectedEntry = selected && JSON.stringify([selected.scope.server, selected.scope.userId, selected.scope.householdId]) === actions.scopeKey ? selected : null
  const cancellable = selectedEntry && actions.status.entries.some((entry) => entry.id === selectedEntry.id)
  const cancelDisabled = !cancellable || actions.status.sendingId === selectedEntry?.id || actions.status.storageUnavailable || cancellation.isPending || retry.isPending || preview.isPending
  const current = reviewEntry && preview.variables === reviewEntry.id ? preview.data : undefined
  const summary = [actions.status.progress.done ? t('sync.delivered_count', { count: actions.status.progress.done }) : '',
    actions.status.cancelled ? t('sync.cancelled_count', { count: actions.status.cancelled }) : ''].filter(Boolean).join(' · ')
  const guidance = actions.status.storageUnavailable ? 'sync.storage_error_description'
    : online !== true ? 'sync.offline_recovery' : actions.status.syncing ? 'sync.sending_recovery' : null
  const filters: { id: Filter; label: string; count: number; icon: typeof ClockIcon }[] = [
    { id: 'all', label: t('sync.all'), count: entries.length, icon: LayersIcon },
    { id: 'pending', label: t('sync.to_send'), count: pending.length, icon: ClockIcon },
    { id: 'failed', label: t('sync.attention'), count: failed.length, icon: TriangleAlertIcon },
  ]
  const close = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/') }, [])
  const [observedScope, setObservedScope] = useState<string | null>(null)
  if (actions.status.entries.length > 0 && observedScope !== actions.scopeKey) setObservedScope(actions.scopeKey)
  const completed = observedScope === actions.scopeKey && actions.isSuccess &&
    actions.status.entries.length === 0 && !actions.status.storageUnavailable &&
    !actions.status.syncing && !retry.isPending && !preview.isPending && !cancellation.isPending && selectedEntry === null && reviewEntry === null
  if (completed) return <AppShell nav={{ kind: 'modal' }} scrollable={false}><SyncCompletion onDone={close}
    synced={actions.status.progress.done} cancelled={actions.status.cancelled} /></AppShell>
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
        {guidance ? <Text testID="queued-recovery-guidance" fontSize={13} lineHeight={20} color={palette.inkSecondary}>{t(guidance)}</Text> : null}
        {actions.status.progress.total > 0 ? <YStack gap="$2">
          <Text fontSize={13} fontWeight="600" color={palette.ink} accessibilityLiveRegion="polite">
            {t(actions.status.cancelled ? 'sync.global_resolved' : 'sync.global_progress', { done: actions.status.progress.done,
              cancelled: actions.status.cancelled, total: actions.status.progress.total })}
          </Text>
          <ProgressBar testID="queued-global-progress" palette={{ ...palette, fresh: palette.freshText }}
            value={actions.status.progress.done + actions.status.cancelled} total={actions.status.progress.total}
            label={t(actions.status.cancelled ? 'sync.resolution_progress' : 'sync.progress')} />
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
            onCancel={() => setSelected(item)} disabled={cancellation.isPending || retry.isPending || preview.isPending || actions.status.storageUnavailable}
            onRetry={() => { if (!retryDisabled) retry.mutate({ id: item.id, reconnect: item.error?.type === 'unauthenticated' }) }} retryDisabled={retryDisabled || cancellation.isPending}
            onOverwrite={() => { if (!retryDisabled && !cancellation.isPending) { setReview(item); preview.reset(); preview.mutate(item.id) } }}
            connected={online === true}
            sending={actions.status.sendingId === item.id || (!actions.status.syncing && retry.isPending && retry.variables?.id === item.id && actions.status.entries.some((entry) => entry.id === item.id))}
            retrying={retry.isPending && retry.variables?.id === item.id}
            cancelling={cancellation.isPending && cancellation.variables === item.id} />}
          ListEmptyComponent={<YStack paddingVertical="$6" paddingHorizontal="$2" gap="$3" alignItems="center">
            {actions.isPending ? <SkeletonList palette={palette} rows={3} label={t('sync.loading')} /> : <Text fontSize={16} fontWeight="700" textAlign="center" color={palette.ink}>
              {t(actions.isError ? 'sync.load_error'
                : filter === 'pending' ? 'sync.empty_pending' : filter === 'failed' ? 'sync.empty_failed' : 'sync.empty')}
            </Text>}
            {!actions.isPending && !actions.isError && entries.length === 0 ? <Text fontSize={14} lineHeight={21}
              textAlign="center" color={palette.inkSecondary}>{summary || t('sync.empty_description')}</Text> : null}
            {actions.isError && !actions.status.storageUnavailable ? <PillButton palette={palette} label={t('dashboard.try_again')}
              onPress={() => { void actions.refetch() }} centered /> : null}
          </YStack>} />
      </YStack>
    </AppShell>
    <ActionSheet visible={reviewEntry !== null} onClose={() => setReview(null)}
      title={reviewEntry ? t('sync.review_title', { name: reviewEntry.base.name }) : undefined}
      description={t('sync.review_description')} closeLabel={t('sync.keep_conflict')}
      options={current && reviewEntry ? [{ testID: 'queued-overwrite-confirm', label: t('sync.overwrite_confirm'),
        destructive: true, tint: palette.expired, icon: (color) => <RefreshIcon size={18} color={color} />,
        disabled: retryDisabled || cancellation.isPending || !actions.status.entries.some((entry) => entry.id === reviewEntry.id && entry.error?.type === 'sync_conflict'),
        onPress: () => { if (!retryDisabled && !cancellation.isPending) { retry.mutate({ id: reviewEntry.id, reviewedUpdatedAt: current.updatedAt }); setReview(null) } },
      }] : [{ testID: 'queued-overwrite-reload', label: t('sync.review_reload'), pending: preview.isPending,
        disabled: online !== true || actions.status.storageUnavailable || actions.status.syncing, keepOpen: true,
        tint: palette.soon, icon: (color) => <RefreshIcon size={18} color={color} />,
        onPress: () => { if (reviewEntry) preview.mutate(reviewEntry.id) },
      }]}>
      {preview.isPending ? <SkeletonList palette={palette} rows={1} label={t('sync.review_loading')} /> : null}
      {preview.isError ? <Text role="alert" fontSize={14} lineHeight={21} color={palette.expiredText}>{recoveryMessage(preview.error, 'sync.review_error')}</Text> : null}
      {guidance ? <Text fontSize={13} lineHeight={20} color={palette.inkSecondary}>{t(guidance)}</Text> : null}
      {current && reviewEntry ? <YStack gap="$4" paddingVertical="$3">
        {Object.entries(reviewEntry.patch ?? {}).filter(([field]) => field !== 'expectedUpdatedAt').map(([field, value]) => {
          const label = t(`sync.fields.${field}`)
          const before = valueLabel(field, (current as unknown as Record<string, unknown>)[field], true)
          const after = valueLabel(field, value)
          return <YStack key={field} gap="$2" accessible
            accessibilityLabel={t('sync.review_change_description', { field: label, before, after })}>
            <Text fontSize={13} fontWeight="700" color={palette.ink}>{label}</Text>
            <Text fontSize={14} lineHeight={21} color={palette.inkSecondary}>{t('sync.household_value', { value: before })}</Text>
            <Text fontSize={18} lineHeight={25} fontWeight="800" color={palette.ink}>{t('sync.proposed_value', { value: after })}</Text>
          </YStack>
        })}
      </YStack> : null}
    </ActionSheet>
    <ActionSheet visible={selectedEntry !== null} onClose={() => setSelected(null)}
      title={selectedEntry ? t('sync.cancel_named', { name: selectedEntry.base.name }) : undefined}
      description={t(selectedEntry && selectedEntry.attempts > 0 ? 'sync.cancel_retry_description' : 'sync.cancel_description')}
      closeLabel={t('sync.keep')} options={[{
        testID: 'queued-cancel-confirm', label: t('sync.cancel_confirm'), destructive: true,
        disabled: cancelDisabled,
        tint: palette.expired, icon: (color) => <XIcon size={18} color={color} />,
        onPress: () => { if (selectedEntry && !cancelDisabled) { cancellation.mutate(selectedEntry.id); setSelected(null) } },
      }]}>
      {cancelDisabled && selectedEntry ? <Text fontSize={13} lineHeight={20} color={palette.inkSecondary}>
        {t(!cancellable ? 'sync.cancel_action_unavailable' : guidance ?? 'sync.cancel_action_syncing')}
      </Text> : null}
    </ActionSheet>
    </>
  )
}
