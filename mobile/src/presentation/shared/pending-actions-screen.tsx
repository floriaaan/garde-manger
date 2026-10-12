import { SectionList, Platform } from 'react-native'
import { router } from 'expo-router'
import { useQueuedActions } from '../../application/sync/mutation-queue-context.js'
import type { QueuedMutation } from '../../application/sync/mutation-queue.js'
import { formatCurrency, getLocale, useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ArrowRightIcon, CheckIcon, CircleCheckIcon, ClockIcon, TrashIcon, TriangleAlertIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { AppShell, shellContentStyle, useAppShellLayout } from './app-shell.js'
import { Pressable } from './pressable.js'
import { PillButton } from './pill-button.js'
import { Text, XStack, YStack } from './tamagui-typed.js'

function ActionRow({ entry }: { entry: QueuedMutation }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const failed = Boolean(entry.error)
  const secondaryColor = failed ? palette.expiredText : palette.inkSecondary
  const fields = Object.entries(entry.patch ?? {}).filter(([field]) => field !== 'expectedUpdatedAt')
  function valueLabel(field: string, value: unknown, before = false): string {
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0))
      return t(before ? 'sync.not_set' : 'sync.cleared')
    if (field === 'checked') return t(value ? 'sync.checked' : 'sync.unchecked')
    if (field === 'quantity') {
      const quantity = value as { amount: number; unit: string }
      return `${new Intl.NumberFormat(getLocale()).format(quantity.amount)} ${quantity.unit}`
    }
    if (field === 'location') return t(`fridge.${value}`)
    if (field === 'price') return formatCurrency(value as number)
    if (field === 'expiresAt' || field === 'openedAt')
      return new Date(value as string).toLocaleDateString(getLocale(), { timeZone: 'UTC' })
    return Array.isArray(value) ? value.join(', ') : String(value)
  }
  return (
    <YStack paddingVertical="$4" paddingHorizontal={failed ? 16 : 0} gap="$2.5"
      backgroundColor={failed ? palette.expiredBg : undefined} testID={`queued-action-${entry.id}`}>
      <YStack gap="$1">
        <Text fontSize={18} lineHeight={25} fontWeight="800" color={palette.ink}>{entry.base.name}</Text>
        <Text fontSize={13} color={secondaryColor}>
          {t(entry.collection === 'products' ? 'sync.products' : 'sync.shopping')}
        </Text>
      </YStack>
      {fields.map(([field, value]) => {
        const oldValue = valueLabel(field, (entry.base as unknown as Record<string, unknown>)[field], true)
        const newValue = valueLabel(field, value)
        const label = t(`sync.fields.${field}`)
        return (
          <YStack key={field} gap="$1.5" accessible
            accessibilityLabel={t('sync.change_description', { field: label, before: oldValue, after: newValue })}>
            <Text fontSize={13} fontWeight="500" color={secondaryColor}>{label}</Text>
            <XStack gap="$3" alignItems="center">
              <Text flex={1} minWidth={0} fontSize={16} lineHeight={23} color={secondaryColor}>{oldValue}</Text>
              <YStack flexShrink={0} accessible={false} aria-hidden>
                <ArrowRightIcon size={20} color={secondaryColor} />
              </YStack>
              <XStack flex={1} minWidth={0} gap="$1.5" alignItems="center">
                <Text flex={1} minWidth={0} fontSize={22} lineHeight={29} fontWeight="800" color={palette.ink}>{newValue}</Text>
                {field === 'checked' && value === true ? <YStack flexShrink={0} accessible={false} aria-hidden>
                  <CheckIcon size={18} color={palette.freshText} />
                </YStack> : null}
              </XStack>
            </XStack>
          </YStack>
        )
      })}
      {entry.patch === null ? <XStack gap="$2" alignItems="center">
        <YStack accessible={false} aria-hidden><TrashIcon size={21} color={secondaryColor} /></YStack>
        <Text fontSize={17} lineHeight={24} fontWeight="700" color={palette.ink}>{t('sync.delete')}</Text>
      </XStack> : null}
      {entry.error ? <Text fontSize={13} lineHeight={20} color={palette.expiredText}>{t(
        entry.error.type === 'sync_conflict' ? 'sync.conflict'
          : ['product_not_found', 'shopping_item_not_found'].includes(entry.error.type) ? 'sync.deleted' : 'sync.refused',
      )}</Text> : <XStack gap="$2" alignItems="center">
        <YStack accessible={false} aria-hidden><ClockIcon size={16} color={palette.soonText} /></YStack>
        <Text flex={1} minWidth={0} fontSize={13} lineHeight={19} fontWeight="600" color={palette.soonText}>
          {t(entry.attempts > 0 ? 'sync.retrying' : 'sync.waiting')}
        </Text>
      </XStack>}
    </YStack>
  )
}

export function PendingActionsScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const actions = useQueuedActions()
  const layout = useAppShellLayout({ kind: 'modal' })
  const entries = actions.data ?? []
  const pending = entries.filter((entry) => !entry.error)
  const failed = entries.filter((entry) => entry.error)
  const sections = [{ failed: false, data: pending }, { failed: true, data: failed }]
    .filter((section) => section.data.length > 0)
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/') }
  return (
    <AppShell nav={{ kind: 'modal' }} surfaceColor={palette.cream} scrollable={false} header={
      <XStack gap="$3" alignItems="flex-start">
        <YStack flex={1} minWidth={0} gap="$2">
          <Text role="heading" fontFamily={Platform.OS === 'web' ? '$heading' : undefined}
            fontSize={26} lineHeight={32} fontWeight={Platform.OS === 'web' ? '600' : '800'} color={palette.ink}>
            {t('sync.title')}
          </Text>
          {actions.isSuccess ? <Text fontSize={13} lineHeight={19} fontWeight="600" color={palette.inkSecondary}>
            {t('sync.count', { count: entries.length })}
          </Text> : null}
        </YStack>
        <Pressable accessibilityRole="button" accessibilityLabel={t('shared.close')}
          onPress={close} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24,
            alignItems: 'center', justifyContent: 'center', backgroundColor: palette.creamPill, opacity: pressed ? 0.7 : 1 })}>
          <XIcon size={20} color={palette.ink} />
        </Pressable>
      </XStack>
    }>
      <SectionList<QueuedMutation, { failed: boolean }> sections={sections} keyExtractor={(entry) => String(entry.id)}
        stickySectionHeadersEnabled={false} contentContainerStyle={shellContentStyle(layout)}
        ListHeaderComponent={entries.length > 0 ? <XStack backgroundColor={palette.mintPale} borderRadius={14}
          padding="$4" gap="$3" alignItems="center" marginBottom="$3">
          <YStack flexShrink={0} accessible={false} aria-hidden><CircleCheckIcon size={28} color={palette.mintPaleText} /></YStack>
          <YStack flex={1} minWidth={0} gap="$1">
            <Text fontSize={16} lineHeight={22} fontWeight="800" color={palette.mintPaleText}>{t('sync.on_device')}</Text>
            <Text fontSize={13} lineHeight={19} color={palette.mintPaleText}>
              {t(pending.length > 0 ? 'sync.send_when_available' : 'sync.needs_attention')}
            </Text>
          </YStack>
        </XStack> : null}
        renderSectionHeader={({ section }) => section.failed ? <XStack marginTop="$5" padding="$4"
          gap="$2.5" backgroundColor={palette.expiredBg} borderTopLeftRadius={16} borderTopRightRadius={16} alignItems="center">
          <YStack flexShrink={0} accessible={false} aria-hidden><TriangleAlertIcon size={22} color={palette.expiredText} /></YStack>
          <Text flex={1} minWidth={0} role="heading" fontSize={20} lineHeight={27} fontWeight="800" color={palette.expiredText}>{t('sync.attention')}</Text>
        </XStack> : null}
        renderSectionFooter={({ section }) => section.failed ? <YStack height={16} backgroundColor={palette.expiredBg}
          borderBottomLeftRadius={16} borderBottomRightRadius={16} /> : null}
        ItemSeparatorComponent={({ section }) => <YStack paddingHorizontal={section.failed ? 16 : 0}
          backgroundColor={section.failed ? palette.expiredBg : undefined}>
          <YStack height={1} backgroundColor={section.failed ? palette.expiredText : palette.creamPillEdge}
            opacity={section.failed ? 0.2 : 1} />
        </YStack>}
        renderItem={({ item }) => <ActionRow entry={item} />}
        ListEmptyComponent={<YStack paddingVertical="$6" gap="$3" alignItems="center">
          <Text fontSize={16} fontWeight="700" textAlign="center" color={palette.ink}>
            {t(actions.isPending ? 'sync.loading' : actions.isError ? 'sync.load_error' : 'sync.empty')}
          </Text>
          {!actions.isPending && !actions.isError ? <Text fontSize={14} lineHeight={21} textAlign="center" color={palette.inkSecondary}>
            {t('sync.empty_description')}
          </Text> : null}
          {actions.isError ? <PillButton palette={palette} label={t('dashboard.try_again')}
            onPress={() => { void actions.refetch() }} centered /> : null}
        </YStack>} />
    </AppShell>
  )
}
