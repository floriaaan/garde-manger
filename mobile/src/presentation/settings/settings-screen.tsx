import { useTranslation } from '../../i18n/index.js'
import { useState } from 'react'
import { Linking } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { PillButton } from '../shared/pill-button.js'
import { useHint } from '../shared/hint-bubble.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { useSoftPalette, type SoftPalette } from '../dashboard/soft-palette.js'
import {
    HomeIcon,
  BellIcon,
  LogOutIcon,
    ServerIcon,
  SettingsIcon,
  SparklesIcon,
    BadgeCheckIcon,
  WalletIcon,
} from '../dashboard/dashboard-icons.js'
import { IdentityCard, RoleBadge } from './identity-card.js'
import { NUDGE_RATIO } from './ai-access-cards.js'
import { Avatar } from '../shared/avatar.js'
import { AuthButton } from '../identity/auth-button.js'
import { ROLE_LABELS } from '../identity/role-labels.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { disablePush } from '../../application/push/push-notifications.js'
import { showToast } from '../../application/shared/toast.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useInstanceInfoQuery } from '../../application/instance/instance-info.query.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PRIVACY_POLICY_URL = 'https://gardemanger.floriaaan.fr/privacy'
const TERMS_OF_USE_URL = 'https://gardemanger.floriaaan.fr/cgu'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }

// A pushed screen (reached from the dashboard's "Réglages" link), not one
// of the four tabs — so `AppShell`'s `{ kind: 'stack' }` nav: no bottom
// tab nav, a BackButton in the header instead (same convention recipe/
// shopping-list already used), still the full BlobBackground + tablet/
// desktop Sidebar shell everywhere else gets. An audit found this screen
// had none of that — no shell at all, not even a way back on mobile
// except the OS gesture.
//
// Redesigned (2026-08-30) to feel as crafted as the dashboard: the same
// pastel StatCard language for account/household identity, the same chip
// pattern as the fridge's location filters for the provider picker, and
// sign-out as a real secondary `AuthButton` — moved here from the
// dashboard header's small text link, its one home now.
//
// Narrowed to configuration (2026-09-06): the receipt history left for the
// dashboard (`ReceiptsRow`) — a list of what the foyer bought is content, and
// filing it under a "Données" heading in the screen you open to change how the
// app behaves is where it went to be forgotten. What is left here changes
// behaviour: who you are, which foyer, which AI, and the way out.
//
// The identity pair was widened (2026-09-05): the two half-width StatCards
// truncated the household name to "Le foyer de F…" on every phone, which is
// the one string on this screen that has to be readable. They are now two
// stacked full-width `IdentityCard`s, and the foyer's card stopped being a
// name with the word "gérer" after it — it shows who is in the foyer
// (member avatars) and what you are in it (role badge), so the tap has
// something to promise.
/** Names what the cards under it are about: yours, the household's, the service's. */
function SectionLabel({ palette, marginTop, children }: { palette: SoftPalette; marginTop?: '$2'; children: string }) {
  return (
    <Text
      fontSize={12}
      fontWeight="800"
      letterSpacing={0.6}
      textTransform="uppercase"
      color={palette.inkSecondary}
      marginTop={marginTop}
      role="heading"
    >
      {children}
    </Text>
  )
}

export function SettingsScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const session = useSessionQuery()
  const household = useHouseholdQuery()
  const signOut = useSignOutMutation()
  const settings = useAiSettingsQuery()
  const instance = useInstanceInfoQuery()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const connector = useConnector()
  const [hint] = useHint()
  const refresh = usePullToRefresh(
    () => session.refetch(),
    () => household.refetch(),
    () => settings.refetch(),
    () => instance.refetch(),
  )

  async function handleSignOut() {
    setConfirmingSignOut(false)
    // Before the session goes: the call is authenticated, and this device must
    // stop receiving the previous account's pushes.
    try {
      await disablePush(connector, { keepPreference: true })
      await signOut.mutateAsync(undefined)
    } catch {
      showToast(t('settings.couldn_t_finish_signing_out_try_again'), 'error')
      return
    }
    await session.refetch()
    router.replace('/(auth)/sign-in')
  }

  const signOutError = signOut.error ? t('settings.an_error_occurred_while_signing_out') : null
  const members = household.data?.members ?? []
  const memberSummary = members.length > 0 ? t('identity.member_2', { count: members.length }) : undefined
  const roleLabel = household.data ? ROLE_LABELS[household.data.role] : null
  const householdSpokenLabel = [
    t('identity.household'),
    household.isPending ? t('settings.loading') : household.isError ? t('settings.unavailable') : (household.data?.name ?? t('settings.no_household')),
    memberSummary,
    roleLabel ? t('settings.you_are_role', { role: roleLabel.toLowerCase() }) : null,
    t('settings.manage_household'),
  ]
    .filter(Boolean)
    .join('. ')

  // Never state a fact about the plan before the plan has loaded.
  const plan = settings.data?.access.plan
  const subscriptionValue = plan === 'subscriber' ? t('settings.active') : plan === 'free' ? t('settings.free_plan') : settings.data ? t('settings.not_applicable') : '—'
  const subscriptionSecondary = !settings.data
    ? settings.isError
      ? t('settings.pull_to_try_again')
      : t('dashboard.loading_2')
    : plan === 'self-hosted'
      ? t('settings.self_hosted_server_unlimited_ai')
      : plan === 'subscriber'
        ? t('settings.ai_for_the_entire_household')
        : settings.data.access.limit !== null
          ? settings.data.access.used / settings.data.access.limit >= NUDGE_RATIO
            ? t('settings.more_calls_with_a_subscription_2', { value1: settings.data.access.used, value2: settings.data.access.limit })
            : t('settings.ai_calls_this_month_2', { value1: settings.data.access.used, value2: settings.data.access.limit })
          : t('settings.a_free_ai_quota_every_month')

  return (
    <AppShell nav={{ kind: 'stack' }} hint={hint} refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <SettingsIcon size={19} color={color} />}
          title={t('dashboard.settings')}
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$3" marginTop="$5">
        <SectionLabel palette={palette}>{t('settings.you')}</SectionLabel>
        <IdentityCard
          testID="settings-account"
          bg={palette.cream}
          labelColor={palette.creamText}
          chipColor={palette.chipOrange}
          avatar={<Avatar name={session.data?.user.name ?? ''} image={session.data?.user.image} palette={palette} backgroundColor={palette.chipOrange} color={palette.accentWarmText} />}
          label={t('settings.account')}
          value={session.data?.user.name || '—'}
          secondary={session.data?.user.email}
          corner="a"
          palette={palette}
          onPress={() => router.push('/account')}
        />
        <IdentityCard testID="settings-notifications-page" bg={palette.butter}
          labelColor={palette.butterText} chipColor={palette.chipButter}
          icon={<BellIcon size={18} color={palette.onDark} />} label={t('settings.notifications')}
          value={t('settings.manage_notifications')} secondary={t('settings.expiry_check_up_and_general_notifications')}
          corner="a" palette={palette} onPress={() => router.push('/notifications')} />
        <SectionLabel palette={palette} marginTop="$2">{t('dashboard.your_household')}</SectionLabel>
        <IdentityCard
          testID="settings-household"
          bg={palette.mintPale}
          labelColor={palette.mintPaleText}
          chipColor={palette.chipTeal}
          icon={<HomeIcon size={18} color={palette.onDark} />}
          label={t('identity.household')}
          // Three distinct states, three distinct sentences. A failed read used
          // to render "Aucun foyer" — a fact about the account, printed for a
          // fact about the network, which invents a state the user does not
          // have and cannot act on.
          value={household.isPending ? '—' : household.isError ? t('settings.household_unavailable') : (household.data?.name ?? t('settings.no_household_2'))}
          secondary={
            household.isError ? t('settings.pull_to_try_again') : (memberSummary ?? t('settings.no_one_else_yet'))
          }
          trailing={roleLabel ? <RoleBadge label={roleLabel} palette={palette} /> : null}
          corner="b"
          palette={palette}
          onPress={() => router.push('/household')}
          // The card is a Pressable, so RN collapses its children into this
          // one label: "Gérer le foyer" alone swallowed the foyer's name, its
          // member count, the role badge and the avatars — everything the card
          // was redesigned to show.
          accessibilityLabel={householdSpokenLabel}
        />
        {plan === 'self-hosted' ? null : (
          <IdentityCard
            testID="settings-subscription"
            bg={palette.butter}
            labelColor={palette.butterText}
            chipColor={palette.chipButter}
            icon={<WalletIcon size={18} color={palette.onDark} />}
            label={t('settings.subscription')}
            value={subscriptionValue}
            secondary={subscriptionSecondary}
            accessibilityLabel={t('settings.subscription_3', { value1: subscriptionValue, value2: subscriptionSecondary })}
            corner="a"
            palette={palette}
            onPress={() => router.push('/subscription')}
          />
        )}
      </YStack>

      <YStack marginTop="$3" gap="$3">
        <SectionLabel palette={palette} marginTop="$2">{t('settings.the_service')}</SectionLabel>
        <IdentityCard
          testID="settings-ai-provider"
          bg={palette.lavender}
          labelColor={palette.lavenderText}
          chipColor={palette.chipViolet}
          icon={<SparklesIcon size={18} color={palette.onDark} />}
          label={t('settings.artificial_intelligence')}
          // What the section governs, before what it offers. Named
          // "Fournisseur IA", it asked the foyer to pick between three
          // vendors without ever saying what the pick changes.
          value={
            settings.data && !settings.data.canChooseProvider
              ? t('settings.managed_by_garde_manger')
              : settings.data?.activeProvider
                ? PROVIDER_LABELS[settings.data.activeProvider]
                : '—'
          }
          secondary={t('settings.reads_your_receipts_and_creates_your_recipes')}
          corner="b"
          palette={palette}
          onPress={() => router.push('/ai-provider')}
        />
        <IdentityCard
          testID="settings-instance"
          bg={palette.cream}
          labelColor={palette.creamText}
          chipColor={palette.chipOrange}
          icon={<ServerIcon size={17} color={palette.onDark} />}
          label={t('settings.server')}
          value={
            instance.data
              ? instance.data.name ?? (instance.data.mode === 'hosted' ? t('settings.official_garde_manger') : t('settings.self_hosted_garde_manger'))
              : '—'
          }
          valueBadge={
            instance.data?.mode === 'hosted' ? <BadgeCheckIcon size={18} color={palette.chipTeal} /> : undefined
          }
          // No raw URL or version here — that's technical detail, not a
          // setting; "Changer de serveur" is what this card leads to.
          secondary={
            instance.data ? t('settings.connected_to_this_server') : instance.isError ? t('settings.couldn_t_reach_this_server') : t('dashboard.loading_2')
          }
          corner="a"
          palette={palette}
          onPress={() => router.push('/server-info')}
        />
      </YStack>

      {/* Dev-only door to `/debug` (also reachable by triple-tapping the logo on the auth screens). Never bundled into a release build. */}
      {__DEV__ ? (
        <YStack marginTop="$8" gap="$2">
          <Text fontSize={13} fontWeight="800" color={palette.ink}>{t('settings.debug_dev_only')}</Text>
          <PillButton
            testID="debug-menu-open"
            label={t('settings.open_debug_menu')}
            tone="quiet"
            size="dense"
            palette={palette}
            icon={(color) => <SettingsIcon size={14} color={color} />}
            onPress={() => router.push('/debug')}
          />
        </YStack>
      ) : null}

      {/* One consistent $8 rhythm between every section on the page (Serveur
          above, this, the version line below) — the version line used to sit
          between Serveur and Debug at its own $5, which broke that rhythm and
          read as a stray fact dropped mid-list rather than the page's close. */}
      <YStack marginTop="$8" gap="$2">
        <AuthButton
          testID="sign-out"
          label={t('settings.sign_out')}
          pendingLabel={t('settings.signing_out')}
          pending={signOut.isPending}
          variant="secondary"
          icon={<LogOutIcon size={16} color={palette.ink} />}
          // Confirmed like every other consequential action in the app. It was
          // the one exception, and the scene it fails in is a shared kitchen
          // tablet: a mis-tap signs the whole foyer's device out.
          onPress={() => setConfirmingSignOut(true)}
        />
        {signOutError ? (
          <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
            {signOutError}
          </Text>
        ) : null}
      </YStack>

      <YStack marginTop="$8" alignItems="center" gap="$2">
        {/* The App Store wants the privacy policy reachable in the app, not only on the listing (5.1.1(i)). */}
        <XStack gap="$4">
          <Text
            testID="settings-privacy-policy"
            fontSize={12}
            fontWeight="700"
            color={palette.inkSecondary}
            textDecorationLine="underline"
            accessibilityRole="link"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >{t('settings.privacy')}</Text>
          <Text
            testID="settings-terms"
            fontSize={12}
            fontWeight="700"
            color={palette.inkSecondary}
            textDecorationLine="underline"
            accessibilityRole="link"
            onPress={() => Linking.openURL(TERMS_OF_USE_URL)}
          >{t('settings.terms_of_use')}</Text>
        </XStack>
        <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>{t('settings.garde_manger_v', { value1: Constants.expoConfig?.version ?? '—' })}</Text>
      </YStack>

      <ActionSheet
        visible={confirmingSignOut}
        title={t('settings.sign_out_2')}
        description={t('settings.you_ll_need_to_sign_in_again_to_access_the')}
        options={[
          {
            testID: 'sign-out-confirm',
            label: t('settings.sign_out'),
            icon: (color) => <LogOutIcon size={18} color={color} />,
            tint: palette.expiredBg,
            destructive: true,
            onPress: handleSignOut,
          },
        ]}
        onClose={() => setConfirmingSignOut(false)}
      />
    </AppShell>
  )
}
