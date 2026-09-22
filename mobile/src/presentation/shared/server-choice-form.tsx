import { useState } from 'react'
import { Animated, Linking, Platform, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, pressAreaSlop, useHoverPress } from './hover.js'
import { ripple, rippleClip } from './material.js'
import { AuthField } from '../identity/auth-field.js'
import { AuthButton } from '../identity/auth-button.js'
import { AuthError } from '../identity/auth-error.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { APP_UPDATE_URL, APP_VERSION, getDefaultServerUrl, OFFICIAL_SERVER_URL } from '../../application/shared/server-config.js'
import { CircleCheckIcon, RefreshIcon, SearchIcon, TriangleAlertIcon } from '../dashboard/dashboard-icons.js'
import { haptic } from './haptics.js'
import type { InstanceInfo } from '../../domain/instance/instance-info.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

type Mode = 'official' | 'self-hosted'

/** Strips a leading "v" so "v1.2.0" and "1.2.0" compare equal. */
function normalizeVersion(version: string): string {
  return version.replace(/^v/i, '')
}

function RadioOption({
  testID,
  palette,
  selected,
  disabled,
  title,
  subtitle,
  onPress,
}: {
  testID?: string
  palette: SoftPalette
  selected: boolean
  disabled?: boolean
  title: string
  subtitle: string
  onPress: () => void
}) {
  const hover = useHoverPress()

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        // A tap that doesn't change the selection isn't a selection event.
        if (!selected) haptic(() => Haptics.selectionAsync())
        onPress()
      }}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      android_ripple={ripple(palette.chipTeal)}
      style={[pointerCursor, rippleClip(18)]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="flex-start"
          gap="$3"
          borderRadius={18}
          padding="$4"
          backgroundColor={selected ? palette.mintPale : palette.gradientBottom}
          opacity={disabled ? 0.5 : 1}
        >
          <YStack
            marginTop={2}
            width={22}
            height={22}
            borderRadius={11}
            backgroundColor={selected ? palette.chipTeal : palette.creamPillEdge}
            alignItems="center"
            justifyContent="center"
          >
            {selected ? <YStack width={9} height={9} borderRadius={5} backgroundColor={palette.onDark} /> : null}
          </YStack>
          <YStack flex={1} gap={4}>
            <Text fontSize={15} fontWeight="800" color={palette.ink}>
              {title}
            </Text>
            <Text fontSize={13} fontWeight="500" lineHeight={18} color={palette.inkSecondary}>
              {subtitle}
            </Text>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

/**
 * The version-mismatch notice on the verify screen. Kept visible even when
 * `APP_UPDATE_URL` is unset (no store listing configured yet) rather than
 * hidden, since the mismatch itself is still true — but then it's disabled
 * and says so, instead of looking tappable and doing nothing.
 */
function UpdateAppBanner({ palette, serverVersion }: { palette: SoftPalette; serverVersion: string }) {
  const hover = useHoverPress()
  const canUpdate = Boolean(APP_UPDATE_URL)
  const slop = 6

  return (
    <XStack testID="server-choice-version-mismatch" alignItems="center" gap="$2" borderRadius={12} padding="$3" backgroundColor={palette.soonBg}>
      <TriangleAlertIcon size={16} color={palette.soonText} />
      <Text flex={1} fontSize={12} fontWeight="600" color={palette.soonText}>
        Serveur en v{serverVersion}, application en v{APP_VERSION}.
      </Text>
      <Pressable
        testID="server-choice-update-app"
        disabled={!canUpdate}
        onPress={() => {
          if (!canUpdate) return
          haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
          void Linking.openURL(APP_UPDATE_URL)
        }}
        onHoverIn={hover.onHoverIn}
        onHoverOut={hover.onHoverOut}
        onPressIn={hover.onPressIn}
        onPressOut={hover.onPressOut}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canUpdate }}
        android_ripple={canUpdate ? ripple(palette.soonText) : undefined}
        hitSlop={{ top: slop, bottom: slop, left: 8, right: 8 }}
        style={[pointerCursor, pressAreaSlop(slop, 8), rippleClip(999)]}
      >
        <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: canUpdate ? 1 : 0.5, minHeight: 32, justifyContent: 'center' }}>
          <XStack alignItems="center" gap="$1">
            <RefreshIcon size={14} color={palette.soonText} />
            <Text fontSize={12} fontWeight="700" color={palette.soonText}>
              Mettre à jour
            </Text>
          </XStack>
        </Animated.View>
      </Pressable>
    </XStack>
  )
}

/**
 * The radio-card + self-host form shared between onboarding
 * (`server-choice-screen.tsx`) and Réglages' "Changer de serveur" page — one
 * place for the "official instance vs self-host" choice and the
 * verify-then-save flow, so a change to either applies to both rather than
 * drifting between two hand-copied forms.
 *
 * "Officiel" points at `OFFICIAL_SERVER_URL` — a hardcoded constant, not a
 * self-typed address, since there is exactly one official instance — picking
 * it verifies right away, no separate "Vérifier" tap (there is no field to
 * type into). The single submit button is "Vérifier" until a check
 * succeeds, then becomes `saveLabel` — editing the URL after a successful
 * check drops back to "Vérifier", since the verified server is no longer
 * the one in the field.
 */
export function ServerChoiceForm({
  palette,
  defaultUrl,
  saveLabel = 'Sauvegarder',
  fieldLabelColor,
  onSave,
}: {
  palette: SoftPalette
  defaultUrl?: string
  saveLabel?: string
  fieldLabelColor?: string
  onSave: (url: string, info: InstanceInfo) => void | Promise<void>
}) {
  const connector = useConnector()
  const initialUrl = defaultUrl ?? getDefaultServerUrl()
  const [mode, setMode] = useState<Mode>(initialUrl === OFFICIAL_SERVER_URL ? 'official' : 'self-hosted')
  const [url, setUrl] = useState(initialUrl)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState<InstanceInfo | null>(null)

  async function verify(targetUrl: string) {
    setError(null)
    setVerified(null)
    const trimmed = targetUrl.trim().replace(/\/+$/, '')
    if (!trimmed) return
    try {
      new URL(trimmed)
    } catch {
      setError("Adresse invalide : il manque le https:// (ex. https://mon-serveur.exemple.com).")
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
      return
    }
    setChecking(true)
    const info = await connector.getInstanceInfo(trimmed)
    setChecking(false)
    if (!info) {
      setError("Ce serveur ne répond pas comme une instance Garde-manger. Vérifie l'adresse.")
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
      return
    }
    setUrl(trimmed)
    setVerified(info)
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
  }

  function handleVerify() {
    return verify(url)
  }

  async function handleSave() {
    if (!verified) return
    setSaving(true)
    try {
      await onSave(url, verified)
    } finally {
      setSaving(false)
    }
  }

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <RadioOption
          testID="server-choice-official"
          palette={palette}
          selected={mode === 'official'}
          title="Garde-manger officiel"
          subtitle="Notre serveur, prêt à l'emploi, sans rien à installer ni à maintenir."
          onPress={() => {
            setMode('official')
            setUrl(OFFICIAL_SERVER_URL)
            void verify(OFFICIAL_SERVER_URL)
          }}
        />
        <RadioOption
          testID="server-choice-self-hosted"
          palette={palette}
          selected={mode === 'self-hosted'}
          title="Auto-hébergé"
          subtitle="Connecte-toi à ton propre serveur Garde-manger : tu gardes la main sur tes données et leur hébergement."
          onPress={() => setMode('self-hosted')}
        />
      </YStack>

      <YStack gap="$3">
        {mode === 'self-hosted' ? (
          <AuthField
            label="Adresse du serveur"
            labelColor={fieldLabelColor}
            placeholder="https://mon-serveur.exemple.com"
            value={url}
            onChangeText={(next) => {
              setUrl(next)
              setVerified(null)
              setError(null)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="server-choice-url"
          />
        ) : null}

        {error ? <AuthError message={error} /> : null}

        {verified && mode === 'self-hosted' ? (
          <YStack borderRadius={14} padding="$3" backgroundColor={palette.mintPale} gap="$1">
            <Text testID="server-choice-found" fontSize={13} fontWeight="700" color={palette.mintPaleText}>
              {verified.name ? `${verified.name} — v${verified.version}` : `Serveur trouvé — v${verified.version}`}
            </Text>
          </YStack>
        ) : null}

        {/* Non-blocking: server ahead of or behind this build doesn't stop
            sign-in, just offers an update. */}
        {verified && mode === 'self-hosted' && normalizeVersion(verified.version) !== normalizeVersion(APP_VERSION) ? (
          <UpdateAppBanner palette={palette} serverVersion={verified.version} />
        ) : null}

        <AuthButton
          testID="server-choice-submit"
          label={verified ? saveLabel : 'Vérifier'}
          pendingLabel={verified ? 'Sauvegarde...' : 'Vérification...'}
          pending={verified ? saving : checking}
          disabled={!url.trim()}
          onPress={verified ? handleSave : handleVerify}
          icon={
            verified ? (
              <CircleCheckIcon size={16} color={palette.accentLimeText} />
            ) : (
              <SearchIcon size={16} color={palette.accentLimeText} />
            )
          }
        />
      </YStack>
    </YStack>
  )
}
