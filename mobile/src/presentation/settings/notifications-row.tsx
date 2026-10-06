import { useTranslation } from '../../i18n/index.js'
import { useEffect, useRef, useState } from 'react'
import { focusManager, useQuery, useQueryClient } from '@tanstack/react-query'
import { Linking, Platform, Pressable, Switch } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { pointerCursor } from '../shared/hover.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { disablePush, enablePush, pushPermissionMessage } from '../../application/push/push-notifications.js'
import { DEVICE_NOTIFICATIONS_KEY, useDeviceNotificationsQuery } from '../../application/push/device-notifications.query.js'
import { NotificationFeedback } from './notification-feedback.js'
import { showToast } from '../../application/shared/toast.js'

/** One full-row switch; its inner Switch is only the visual state. */
export function NotificationsRow({ palette }: { palette: SoftPalette }) {
  const { t } = useTranslation()
  const connector = useConnector()
  const status = useDeviceNotificationsQuery()
  const queryClient = useQueryClient()
  const enabled = status.data === true
  const [pending, setPending] = useState(false)
  const toggling = useRef(false)
  const [note, setNote] = useState<string | null>(null)
  const [needsSettings, setNeedsSettings] = useState(false)
  const [toggleFailed, setToggleFailed] = useState(false)

  const details = useQuery({
    queryKey: ['device-notification-permissions'],
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const [message, key] = await Promise.all([
        pushPermissionMessage(),
        Platform.OS === 'web' ? connector.getWebPushPublicKey() : Promise.resolve(null),
      ])
      return {
        key,
        note: Platform.OS === 'web' && !key ? t('settings.web_push_isn_t_configured_on_this_server') : message,
        needsSettings: Platform.OS !== 'web' && !!message?.startsWith(t('settings.notifications_blocked')),
      }
    },
  })
  const loading = details.isPending
  const loadFailed = details.isError
  const webKey = details.data?.key ?? null

  useEffect(() => {
    return focusManager.subscribe((focused) => {
      if (focused) {
        setNote(null)
        setNeedsSettings(false)
      }
    })
  }, [])

  async function toggle() {
    if (toggling.current) return
    toggling.current = true
    setPending(true)
    setToggleFailed(false)
    setNeedsSettings(false)
    setNote(null)
    try {
      showToast(enabled ? t('settings.disabling') : t('common.enabling_notifications'), 'loading')
      if (enabled) {
        await disablePush(connector)
        queryClient.setQueryData(DEVICE_NOTIFICATIONS_KEY, false)
        void details.refetch()
        showToast(t('settings.notifications_disabled_on_this_device'), 'success')
        return
      }
      if (Platform.OS === 'web' && !webKey) {
        showToast(t('settings.notifications_aren_t_configured_on_this_server'), 'error')
        setNote(t('settings.web_push_isn_t_configured_on_this_server'))
        return
      }
      const result = await enablePush(connector, webKey ?? undefined)
      if (result === 'failed') {
        setToggleFailed(true)
        showToast(t('settings.couldn_t_enable_notifications_right_now'), 'error', {
          label: t('dashboard.try_again'), onPress: () => { void toggle() },
        })
        return
      }
      queryClient.setQueryData(DEVICE_NOTIFICATIONS_KEY, result === 'enabled')
      if (result === 'enabled') {
        void details.refetch()
        showToast(t('settings.notifications_enabled_on_this_device_2'), 'success')
      }
      if (result === 'denied') {
        showToast(t('settings.notifications_not_allowed'), 'error')
        setNeedsSettings(Platform.OS !== 'web')
        setNote(Platform.OS === 'web'
          ? t('settings.allow_notifications_for_this_site_in_your_browser_settings')
          : t('settings.allow_notifications_in_your_phone_settings'))
      }
      if (result === 'unavailable') {
        showToast(t('settings.notifications_unavailable_in_this_environment'), 'error')
        setNote(Platform.OS === 'web'
          ? t('settings.use_an_https_connection_to_receive_notifications_on_iphone_add')
          : t('settings.unavailable_on_this_device_or_app_version'))
      }
    } catch {
      setToggleFailed(true)
      showToast(t('settings.couldn_t_change_notifications'), 'error', {
        label: t('dashboard.try_again'), onPress: () => { void toggle() },
      })
    } finally {
      toggling.current = false
      setPending(false)
    }
  }

  const disabled = pending || loading || loadFailed || status.isPending || status.isError
  const deviceMessage = status.isError ? t('settings.couldn_t_check_notifications_on_this_device')
    : status.isPending || loading ? t('settings.checking_notifications_on_this_device')
    : enabled ? t('settings.notifications_enabled_on_this_device') : t('settings.notifications_disabled_on_this_device_2')

  return (
    <YStack gap="$2">
      <Pressable testID="settings-notifications" onPress={() => { void toggle() }} disabled={disabled}
        accessibilityRole="switch" accessibilityLabel={t('settings.enable_all_notifications_on_this_device')}
        accessibilityHint={t('settings.enable_or_disable_all_notifications_on_this_device')}
        accessibilityState={{ checked: enabled, disabled, busy: pending || loading || status.isPending }}
        style={[pointerCursor, { alignSelf: 'stretch' }]}>
        <XStack width="100%" alignItems="center" justifyContent="space-between" gap="$3" minHeight={56} paddingLeft="$4">
          <YStack width={36} height={36} alignItems="center" justifyContent="center">
            <BellIcon size={20} color={palette.ink} />
          </YStack>
          <Text flex={1} minWidth={0} fontSize={15} lineHeight={22} fontWeight="800" color={palette.ink}>{t('settings.enable_all_notifications')}</Text>
          <XStack minHeight={48} flexShrink={0} alignItems="center" pointerEvents="none"
            accessible={false} importantForAccessibility="no-hide-descendants">
            <Switch testID="settings-notifications-switch" value={enabled}
              style={{ alignSelf: 'center', margin: 0 }} trackColor={{ true: palette.freshText }}
              pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" />
          </XStack>
        </XStack>
      </Pressable>
      <NotificationFeedback message={deviceMessage} error={status.isError} palette={palette} />
      <NotificationFeedback message={note ?? (loadFailed ? t('settings.couldn_t_prepare_notifications_try_again') : details.data?.note ?? null)} error palette={palette} />
      {status.isError || loadFailed || toggleFailed ? <PillButton testID="notifications-retry"
        label={t('dashboard.try_again')} palette={palette} tone="quiet" disabled={pending || loading || status.isFetching || details.isFetching}
        onPress={() => {
          if (status.isError || loadFailed) { void status.refetch(); void details.refetch() }
          else void toggle()
        }} /> : null}
      {!pending && (needsSettings || details.data?.needsSettings) ? <PillButton testID="notifications-system-settings" label={t('settings.open_settings')}
        palette={palette} tone="quiet" onPress={() => {
          void Linking.openSettings().catch(() => showToast(t('settings.couldn_t_open_settings_open_them_from_your_phone'), 'error'))
        }} /> : null}
    </YStack>
  )
}
