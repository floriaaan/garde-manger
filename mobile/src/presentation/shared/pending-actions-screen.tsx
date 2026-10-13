import { useRef, useState } from 'react'
import { Animated, FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueuedActions } from '../../application/sync/mutation-queue-context.js'
import type { QueuedMutation } from '../../application/sync/mutation-queue.js'
import { formatCurrency, getLocale, t as translate, useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ArrowRightIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, RefreshIcon, SmartphoneCheckIcon, TriangleAlertIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { AppShell, shellContentStyle, useAppShellLayout } from './app-shell.js'
import { Chip } from './chip.js'
import { ScreenHeader } from './screen-header.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { ripple, rippleClip } from './material.js'
import { SkeletonList } from './skeleton.js'
import { Pressable } from './pressable.js'
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

function ActionRow({ entry, initiallyExpanded }: { entry: QueuedMutation; initiallyExpanded: boolean }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const hover = useHoverPress()
  const fields = Object.entries(entry.patch ?? {}).filter(([field]) => field !== 'expectedUpdatedAt')
  const summary = entry.patch === null ? t('sync.delete') : fields.map(([field, value]) => valueLabel(field, value)).join(' · ')
  const status = t(entry.error ? 'sync.attention' : entry.attempts > 0 ? 'sync.retrying' : 'sync.waiting')
  const caption = expanded && fields.length === 1 ? t(`sync.fields.${fields[0][0]}`) : summary
  const StatusIcon = entry.error ? TriangleAlertIcon : entry.attempts > 0 ? RefreshIcon : ClockIcon
  const statusColor = entry.error ? palette.expiredText : palette.soonText
  const statusBackground = entry.error ? palette.expiredBg : palette.soonBg
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon
  return (
    <YStack testID={`queued-action-${entry.id}`}>
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <Pressable testID={`queued-action-toggle-${entry.id}`} accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${entry.base.name}. ${summary}. ${status}. ${t(expanded ? 'sync.hide_details' : 'sync.show_details')}`}
          onPress={() => setExpanded((value) => !value)}
          onHoverIn={hover.onHoverIn} onHoverOut={hover.onHoverOut}
          onPressIn={hover.onPressIn} onPressOut={hover.onPressOut} android_ripple={ripple(palette.ink)}
          style={[pointerCursor, rippleClip(12), { minHeight: 72, paddingVertical: 16 }]}>
          <XStack gap="$3" alignItems="center">
            <YStack flex={1} minWidth={0} gap="$1.5">
              <Text fontSize={14} lineHeight={20} fontWeight="800" color={palette.ink}>{entry.base.name}</Text>
              <Text fontSize={13} lineHeight={19} color={palette.inkSecondary}>{caption}</Text>
            </YStack>
            <YStack flexShrink={0} accessible={false} aria-hidden><Chevron size={18} color={palette.inkSecondary} /></YStack>
          </XStack>
        </Pressable>
      </Animated.View>
      <XStack alignItems="center" gap="$1.5" alignSelf="flex-start" paddingHorizontal="$2" paddingVertical="$1"
        marginBottom="$3" borderRadius={999} backgroundColor={statusBackground}>
        <YStack accessible={false} aria-hidden><StatusIcon size={13} color={statusColor} /></YStack>
        <Text fontSize={12} fontWeight="600" color={statusColor}>{status}</Text>
      </XStack>
      {expanded ? <YStack gap="$3" paddingBottom="$4">
        {fields.map(([field, value]) => {
          const oldValue = valueLabel(field, (entry.base as unknown as Record<string, unknown>)[field], true)
          const newValue = valueLabel(field, value)
          const label = t(`sync.fields.${field}`)
          return (
            <YStack key={field} gap="$1.5" accessible
              accessibilityLabel={t('sync.change_description', { field: label, before: oldValue, after: newValue })}>
              {fields.length > 1 ? <Text fontSize={12} color={palette.inkSecondary}>{label}</Text> : null}
              <XStack alignItems="center" gap="$3">
                <Text flex={1} minWidth={0} fontSize={14} lineHeight={20} fontWeight="500" color={palette.inkSecondary}>{oldValue}</Text>
                <YStack flexShrink={0} accessible={false} aria-hidden><ArrowRightIcon size={20} color={palette.inkSecondary} /></YStack>
                <Text flex={2} minWidth={0} fontSize={24} lineHeight={30} fontWeight="800" color={palette.ink}>{newValue}</Text>
              </XStack>
            </YStack>
          )
        })}
        {entry.patch === null ? <Text fontSize={14} lineHeight={21} color={palette.ink}>{t('sync.delete_requested')}</Text> : null}
        <Text fontSize={12} color={palette.inkSecondary}>{t(entry.collection === 'products' ? 'sync.products' : 'sync.shopping')}</Text>
        {entry.error ? <Text fontSize={13} lineHeight={20} color={palette.expiredText}>{t(
          entry.error.type === 'sync_conflict' ? 'sync.conflict'
            : ['product_not_found', 'shopping_item_not_found'].includes(entry.error.type) ? 'sync.deleted' : 'sync.refused',
        )}</Text> : null}
      </YStack> : null}
    </YStack>
  )
}

export function PendingActionsScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const insets = useSafeAreaInsets()
  const closeHover = useHoverPress()
  const actions = useQueuedActions()
  const layout = useAppShellLayout({ kind: 'modal' })
  const [filter, setFilter] = useState<Filter>('all')
  const list = useRef<FlatList<QueuedMutation>>(null)
  const entries = actions.data ?? []
  const pending = entries.filter((entry) => !entry.error)
  const failed = entries.filter((entry) => entry.error)
  const visible = filter === 'pending' ? pending : filter === 'failed' ? failed : entries
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: t('sync.all'), count: entries.length },
    { id: 'pending', label: t('sync.to_send'), count: pending.length },
    { id: 'failed', label: t('sync.attention'), count: failed.length },
  ]
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/') }
  return (
    <AppShell nav={{ kind: 'modal' }} scrollable={false} header={
      <YStack gap="$3">
        <XStack justifyContent="flex-end">
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
        </XStack>
        <ScreenHeader palette={palette}
          icon={(color) => <ClockIcon size={20} color={color} />}
          title={t('sync.title')} subtitle={actions.data !== undefined ? t('sync.count', { count: entries.length }) : undefined} />
        {entries.length > 0 ? <XStack gap="$2.5" alignItems="center" paddingTop="$1" paddingBottom="$1">
          <YStack flexShrink={0} accessible={false} aria-hidden><SmartphoneCheckIcon size={25} color={palette.ink} /></YStack>
          <Text flex={1} minWidth={0} fontSize={14} lineHeight={20} fontWeight="600" color={palette.ink}>{t('sync.on_device')}</Text>
        </XStack> : null}
      </YStack>
    }>
      {/* Paint through AppShell's reserved bottom inset while keeping content inside it. */}
      <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} borderTopLeftRadius={28}
        borderTopRightRadius={18} overflow="hidden" marginBottom={-insets.bottom} paddingBottom={insets.bottom}>
        <XStack gap="$3" flexWrap="wrap" style={{ ...shellContentStyle(layout), paddingTop: 20, paddingBottom: 20 }}
          accessibilityLabel={t('sync.filter_label')}>
          {filters.map((option) => <Chip key={option.id} testID={`queued-filter-${option.id}`}
            label={`${option.label}${actions.data !== undefined ? ` ${option.count}` : ''}`}
            selected={filter === option.id} palette={palette}
            onPress={() => { setFilter(option.id); list.current?.scrollToOffset({ offset: 0, animated: false }) }} />)}
        </XStack>
        <FlatList ref={list} data={visible} keyExtractor={(entry) =>
          `${entry.scope.server}:${entry.scope.userId}:${entry.scope.householdId}:${entry.id}`}
          contentContainerStyle={{ ...shellContentStyle(layout), paddingTop: 0, flexGrow: 1 }}
          ListHeaderComponent={entries.length > 0 && pending.length === 0 ? <Text fontSize={13} lineHeight={19}
            color={palette.inkSecondary} marginBottom="$2">{t('sync.needs_attention')}</Text> : null}
          ItemSeparatorComponent={() => <YStack height={1} backgroundColor={palette.creamPillEdge} />}
          renderItem={({ item, index }) => <ActionRow entry={item} initiallyExpanded={index === 0} />}
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
  )
}
