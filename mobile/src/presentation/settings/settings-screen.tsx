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
  LogOutIcon,
    ServerIcon,
  SettingsIcon,
  SparklesIcon,
    BadgeCheckIcon,
  WalletIcon,
} from '../dashboard/dashboard-icons.js'
import { IdentityCard, RoleBadge } from './identity-card.js'
import { NotificationsRow } from './notifications-row.js'
import { NUDGE_RATIO } from './ai-access-cards.js'
import { initials } from '../shared/member-avatars.js'
import { AuthButton } from '../identity/auth-button.js'
import { ROLE_LABELS } from '../identity/role-labels.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { disablePush } from '../../application/push/push-notifications.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { platformCapabilities } from '../../application/shared/platform-capabilities.js'
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
    await disablePush(connector, { keepPreference: true })
    try {
      await signOut.mutateAsync(undefined)
    } catch {
      return
    }
    await session.refetch()
    router.replace('/(auth)/sign-in')
  }

  const signOutError = signOut.error ? 'Une erreur est survenue lors de la déconnexion.' : null
  const members = household.data?.members ?? []
  const memberSummary = members.length > 0 ? `${members.length} membre${members.length > 1 ? 's' : ''}` : undefined
  const roleLabel = household.data ? ROLE_LABELS[household.data.role] : null
  const householdSpokenLabel = [
    'Foyer',
    household.isPending ? 'chargement' : household.isError ? 'indisponible' : (household.data?.name ?? 'aucun foyer'),
    memberSummary,
    roleLabel ? `tu es ${roleLabel.toLowerCase()}` : null,
    'gérer le foyer',
  ]
    .filter(Boolean)
    .join('. ')

  // Never state a fact about the plan before the plan has loaded.
  const plan = settings.data?.access.plan
  const subscriptionValue = plan === 'subscriber' ? 'Actif' : plan === 'free' ? 'Offre gratuite' : settings.data ? 'Non applicable' : '—'
  const subscriptionSecondary = !settings.data
    ? settings.isError
      ? 'Tire pour réessayer.'
      : 'Chargement…'
    : plan === 'self-hosted'
      ? 'Serveur auto-hébergé : IA sans limite.'
      : plan === 'subscriber'
        ? 'IA pour tout le foyer.'
        : settings.data.access.limit !== null
          ? settings.data.access.used / settings.data.access.limit >= NUDGE_RATIO
            ? `${settings.data.access.used}/${settings.data.access.limit} · Plus d’appels avec l’abonnement`
            : `${settings.data.access.used}/${settings.data.access.limit} appels IA ce mois-ci.`
          : 'Un quota d’IA gratuit chaque mois.'

  return (
    <AppShell nav={{ kind: 'stack' }} hint={hint} refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <SettingsIcon size={19} color={color} />}
          title="Réglages"
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$3" marginTop="$5">
        <SectionLabel palette={palette}>Toi</SectionLabel>
        <IdentityCard
          testID="settings-account"
          bg={palette.cream}
          labelColor={palette.creamText}
          chipColor={palette.chipOrange}
          icon={
            <Text fontSize={14} fontWeight="800" color={palette.onDark}>
              {initials(session.data?.user.name || '?')}
            </Text>
          }
          label="Compte"
          value={session.data?.user.name || '—'}
          secondary={session.data?.user.email}
          corner="a"
          palette={palette}
          onPress={() => router.push('/account')}
        />
        <NotificationsRow palette={palette} />
        <SectionLabel palette={palette} marginTop="$2">Ton foyer</SectionLabel>
        <IdentityCard
          testID="settings-household"
          bg={palette.mintPale}
          labelColor={palette.mintPaleText}
          chipColor={palette.chipTeal}
          icon={<HomeIcon size={18} color={palette.onDark} />}
          label="Foyer"
          // Three distinct states, three distinct sentences. A failed read used
          // to render "Aucun foyer" — a fact about the account, printed for a
          // fact about the network, which invents a state the user does not
          // have and cannot act on.
          value={household.isPending ? '—' : household.isError ? 'Foyer indisponible' : (household.data?.name ?? 'Aucun foyer')}
          secondary={
            household.isError ? 'Tire pour réessayer.' : (memberSummary ?? 'Personne d’autre pour l’instant')
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
        {plan === 'self-hosted' || !platformCapabilities.billing ? null : (
          <IdentityCard
            testID="settings-subscription"
            bg={palette.butter}
            labelColor={palette.butterText}
            chipColor={palette.chipButter}
            icon={<WalletIcon size={18} color={palette.onDark} />}
            label="Abonnement"
            value={subscriptionValue}
            secondary={subscriptionSecondary}
            accessibilityLabel={`Abonnement, ${subscriptionValue}. ${subscriptionSecondary}`}
            corner="a"
            palette={palette}
            onPress={() => router.push('/subscription')}
          />
        )}
      </YStack>

      <YStack marginTop="$3" gap="$3">
        <SectionLabel palette={palette} marginTop="$2">Le service</SectionLabel>
        <IdentityCard
          testID="settings-ai-provider"
          bg={palette.lavender}
          labelColor={palette.lavenderText}
          chipColor={palette.chipViolet}
          icon={<SparklesIcon size={18} color={palette.onDark} />}
          label="Intelligence artificielle"
          // What the section governs, before what it offers. Named
          // "Fournisseur IA", it asked the foyer to pick between three
          // vendors without ever saying what the pick changes.
          value={
            settings.data && !settings.data.canChooseProvider
              ? 'Gérée par Garde-manger'
              : settings.data?.activeProvider
                ? PROVIDER_LABELS[settings.data.activeProvider]
                : '—'
          }
          secondary="Lit tes tickets de caisse et invente tes recettes."
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
          label="Serveur"
          value={
            instance.data
              ? instance.data.name ?? (instance.data.mode === 'hosted' ? 'Garde-manger officiel' : 'Garde-manger auto-hébergé')
              : '—'
          }
          valueBadge={
            instance.data?.mode === 'hosted' ? <BadgeCheckIcon size={18} color={palette.chipTeal} /> : undefined
          }
          // No raw URL or version here — that's technical detail, not a
          // setting; "Changer de serveur" is what this card leads to.
          secondary={
            instance.data ? 'Connecté à ce serveur.' : instance.isError ? 'Impossible de contacter ce serveur.' : 'Chargement…'
          }
          corner="a"
          palette={palette}
          onPress={() => router.push('/server-info')}
        />
      </YStack>

      {/* Dev-only door to `/debug` (also reachable by triple-tapping the logo on the auth screens). Never bundled into a release build. */}
      {__DEV__ ? (
        <YStack marginTop="$8" gap="$2">
          <Text fontSize={13} fontWeight="800" color={palette.ink}>
            Debug (dev only)
          </Text>
          <PillButton
            testID="debug-menu-open"
            label="Ouvrir le menu debug"
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
          label="Se déconnecter"
          pendingLabel="Déconnexion..."
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
          >
            Confidentialité
          </Text>
          <Text
            testID="settings-terms"
            fontSize={12}
            fontWeight="700"
            color={palette.inkSecondary}
            textDecorationLine="underline"
            accessibilityRole="link"
            onPress={() => Linking.openURL(TERMS_OF_USE_URL)}
          >
            Conditions d’utilisation
          </Text>
        </XStack>
        <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>
          Garde-manger · v{Constants.expoConfig?.version ?? '—'}
        </Text>
      </YStack>

      <ActionSheet
        visible={confirmingSignOut}
        title="Se déconnecter ?"
        description="Il faudra se reconnecter pour retrouver le garde-manger du foyer sur cet appareil."
        options={[
          {
            testID: 'sign-out-confirm',
            label: 'Se déconnecter',
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
