import type { ReactNode } from 'react'
import { useState } from 'react'
import { Animated, Pressable, Switch } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { FormCard } from '../shared/form-card.js'
import { AuthField } from '../identity/auth-field.js'
import { PillButton } from '../shared/pill-button.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ArrowLeftIcon, ArrowRightIcon, CircleCheckIcon, HomeIcon, LogOutIcon, RefreshIcon } from '../dashboard/dashboard-icons.js'
import { TodoEntityPicker } from './todo-entity-picker.js'
import { useHaLinkQuery } from '../../application/home-assistant/ha-link.query.js'
import { useSaveHaConnectionMutation } from '../../application/home-assistant/save-ha-connection.mutation.js'
import { useDiscoverHaTodoEntitiesMutation } from '../../application/home-assistant/discover-ha-todo-entities.mutation.js'
import { useBindHaListMutation } from '../../application/home-assistant/bind-ha-list.mutation.js'
import { useUnlinkHaMutation } from '../../application/home-assistant/unlink-ha.mutation.js'
import type { HaSyncDirection, HaTodoEntity } from '../../domain/home-assistant/ha-link.js'

const DIRECTION_LABELS: Record<HaSyncDirection, string> = {
  two_way: 'Deux sens',
  push: 'Vers Home Assistant',
  pull: 'Depuis Home Assistant',
}

const DIRECTION_HINTS: Record<HaSyncDirection, string> = {
  two_way: 'Les ajouts faits ici et dans Home Assistant se retrouvent des deux côtés.',
  push: 'Home Assistant reflète cette liste. Un article supprimé là-bas revient.',
  pull: 'Cette liste suit Home Assistant. Tes modifications ici seront écrasées.',
}

const DIRECTION_ICONS: Record<HaSyncDirection, typeof ArrowRightIcon> = {
  two_way: RefreshIcon,
  push: ArrowRightIcon,
  pull: ArrowLeftIcon,
}

/**
 * One radio per line, an icon ahead of the label — same card-row language
 * `TodoEntityPicker`'s rows use (mint fill + check when selected), so the
 * two lists in this screen read as the same kind of control (2026-09-09
 * design pass: chips read as filters, not as "pick exactly one of three").
 */
function DirectionRow({
  direction,
  selected,
  onPress,
}: {
  direction: HaSyncDirection
  selected: boolean
  onPress: () => void
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  const Icon = DIRECTION_ICONS[direction]
  return (
    <Pressable
      testID={`ha-direction-${direction}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={DIRECTION_LABELS[direction]}
      android_ripple={ripple(palette.ink)}
      style={[pointerCursor, rippleClip(16)]}
    >
      <XStack
        alignItems="center"
        gap="$3"
        paddingVertical="$3"
        paddingHorizontal="$3"
        minHeight={52}
        borderRadius={16}
        backgroundColor={selected ? palette.mintPale : palette.gradientBottom}
        style={{
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 1,
        }}
      >
        <Icon size={18} color={selected ? palette.mintPaleText : palette.inkSecondary} />
        <Text flex={1} fontSize={14} fontWeight="700" color={selected ? palette.mintPaleText : palette.ink}>
          {DIRECTION_LABELS[direction]}
        </Text>
        {selected ? <CircleCheckIcon size={18} color={palette.mintPaleText} /> : null}
      </XStack>
    </Pressable>
  )
}

/** A labeled on/off row — the native `Switch`, not another `Chip`: this is a
 * single setting toggling, not one choice among several (2026-09-09 ask). */
function SwitchRow({
  testID,
  label,
  accessibilityLabel,
  value,
  onValueChange,
  palette,
}: {
  testID?: string
  label: ReactNode
  /** VoiceOver/TalkBack announce the bare `Switch` with no name of its own — pass the row's label as text here. */
  accessibilityLabel: string
  value: boolean
  onValueChange: (value: boolean) => void
  palette: SoftPalette
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      <Text flex={1} fontSize={14} fontWeight="600" color={palette.ink}>
        {label}
      </Text>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: palette.paperRing, true: palette.mintPale }}
        thumbColor={palette.onDark}
        accessibilityLabel={accessibilityLabel}
      />
    </XStack>
  )
}

/** French phrasing for the five distinct connection failures — never a
 * single generic message (design §8). */
const CONNECTION_ERROR_MESSAGES: Record<string, string> = {
  unreachable: 'Impossible de joindre cette adresse depuis le serveur.',
  unauthorized: 'Home Assistant a refusé ce jeton.',
  host_not_allowed: "Cet hôte n'est pas autorisé sur ce serveur.",
  invalid_url: "Cette adresse n'est pas valide.",
  token_required: 'Un jeton est requis pour la première connexion.',
}

function lastSyncLabel(lastSyncAt: string | null, lastError: string | null): string {
  if (lastError) return lastError
  if (!lastSyncAt) return 'Jamais synchronisé.'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60000))
  if (minutes < 1) return 'Synchronisé à l’instant.'
  return `Dernière synchro il y a ${minutes} min.`
}

export function HomeAssistantScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const link = useHaLinkQuery()
  const saveConnection = useSaveHaConnectionMutation()
  const discoverEntities = useDiscoverHaTodoEntitiesMutation()
  const bindList = useBindHaListMutation()
  const unlink = useUnlinkHaMutation()
  const editLinkHover = useHoverPress()

  const [step, setStep] = useState<'connect' | 'list'>('connect')
  const [instanceUrl, setInstanceUrl] = useState('')
  const [token, setToken] = useState('')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [entities, setEntities] = useState<HaTodoEntity[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null)
  const [direction, setDirection] = useState<HaSyncDirection>('two_way')
  const [enabled, setEnabled] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)

  // A foyer that's already configured lands straight on the list step. This
  // must hydrate at most once per mount: `link.data` can change again later
  // from a background refetch (refocus/remount, per this app's default query
  // options), and re-running here would clobber an in-progress edit made
  // after "Modifier la connexion" — snapping `step` back to 'list' and
  // `instanceUrl` back to the stored value mid-keystroke.
  //
  // Adjusted during render, not in an effect (react-hooks/set-state-in-effect):
  // this is React's own documented shape for "sync local state from a query
  // result, once" — calling setState mid-render re-renders immediately
  // without committing or painting the stale pass, so there's no flicker,
  // and it sidesteps the extra effect-then-re-render round trip entirely.
  const [hasHydrated, setHasHydrated] = useState(false)
  if (!hasHydrated && link.data?.configured) {
    setHasHydrated(true)
    setStep('list')
    setInstanceUrl(link.data.instanceUrl ?? '')
    setSelectedEntityId(link.data.todoEntityId)
    setSelectedEntityName(link.data.todoEntityName)
    setDirection(link.data.direction)
    setEnabled(link.data.enabled)
  }

  // A single call proves the token *and* returns the list (design §8) — no
  // separate ping that succeeds followed by a discovery that fails. Nothing
  // is persisted here: `discoverHaTodoEntities` takes the credentials inline
  // and never touches the stored link. Persistence happens once, in
  // `handleSave()`, when the foyer actually commits to a chosen list.
  async function handleTestConnection() {
    setConnectionError(null)
    const result = await discoverEntities.mutateAsync({ instanceUrl, token })
    if (!result.ok) {
      setConnectionError(CONNECTION_ERROR_MESSAGES[result.error.type] ?? result.error.message)
      return
    }
    if (result.value.length === 0) {
      setConnectionError('Aucune liste todo sur cette instance.')
      return
    }
    setEntities(result.value)
    setStep('list')
  }

  async function handleSave() {
    setSaveError(null)
    if (!selectedEntityId) return

    // `token` is '' when this save is only changing the list/direction on an
    // already-configured link (the user never re-typed it) — the backend
    // keeps the stored token in that case (design §6), so passing it through
    // as-is is correct for both the first-time and the edit-in-place path.
    const saved = await saveConnection.mutateAsync({ instanceUrl, token })
    if (!saved.ok) {
      setSaveError(CONNECTION_ERROR_MESSAGES[saved.error.type] ?? saved.error.message)
      return
    }

    const result = await bindList.mutateAsync({
      todoEntityId: selectedEntityId,
      todoEntityName: selectedEntityName ?? selectedEntityId,
      direction,
      enabled,
    })
    if (!result.ok) {
      setSaveError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['ha-link'] })
    router.back()
  }

  async function handleUnlink() {
    setConfirmingUnlink(false)
    await unlink.mutateAsync(undefined)
    queryClient.invalidateQueries({ queryKey: ['ha-link'] })
    router.back()
  }

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <HomeIcon size={19} color={color} />}
          title="Home Assistant"
          // A step name, not a step count: "Étape 1/2" would still leave the
          // question of what each step *is*. The two states were otherwise
          // unlabeled — the only cue a foyer had for "which screen is this"
          // was which fields happened to be on it (2026-09-09 design pass).
          subtitle={step === 'connect' ? 'Connexion' : 'Liste et synchronisation'}
          onBack={() => router.back()}
        />
      }
    >
      {link.isError ? (
        // A failed `link` fetch used to look exactly like "never configured":
        // `hasHydrated` never flips, `step` stays on its initial 'connect'
        // value, and an already-linked foyer sees a blank setup form inviting
        // them to re-enter a URL and token that are already stored. Nothing
        // below distinguishes "not set up" from "couldn't check" without this.
        <YStack marginBottom="$4" gap="$2" backgroundColor={palette.expiredBg} padding="$4" borderRadius={18}>
          <Text fontSize={13} fontWeight="700" color={palette.expiredText}>
            État de la connexion indisponible
          </Text>
          <Text fontSize={12} fontWeight="500" color={palette.expiredText} lineHeight={17}>
            Impossible de vérifier si Home Assistant est déjà lié à ce foyer. Réessaie avant de reconfigurer.
          </Text>
          <PillButton
            testID="ha-retry-link"
            label="Réessayer"
            accessibilityLabel="Réessayer de charger l'état de la connexion Home Assistant"
            onPress={() => link.refetch()}
            palette={palette}
            tone="quiet"
          />
        </YStack>
      ) : null}

      {step === 'connect' ? (
        <FormCard palette={palette}>
          <AuthField
            testID="ha-instance-url"
            label="Adresse de l'instance"
            placeholder="Adresse (ex. http://homeassistant.local:8123)"
            value={instanceUrl}
            onChangeText={setInstanceUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <AuthField
            testID="ha-token"
            label="Jeton d'accès longue durée"
            placeholder="Jeton"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            secureTextEntry
          />
          {connectionError ? (
            <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
              {connectionError}
            </Text>
          ) : null}
          <PillButton
            testID="ha-test-connection"
            label="Tester la connexion"
            palette={palette}
            onPress={handleTestConnection}
          />
        </FormCard>
      ) : (
        // One `FormCard`, like every other form screen (shopping-item,
        // fridge-item, receipt review) — this step used to be five loose
        // groups floating directly on the blob background, the one screen
        // in the app that skipped the single-card convention (2026-09-09
        // design pass: "incohérent avec le reste de l'app"). Each group
        // keeps its own small label, same style throughout, so the card
        // reads as three questions answered in order rather than one
        // undifferentiated stack of controls.
        <FormCard palette={palette} gap="$4">
          <YStack gap="$2">
            <Text fontSize={13} fontWeight="700" color={palette.ink}>
              Liste à synchroniser
            </Text>
            <TodoEntityPicker
              entities={
                entities.length > 0
                  ? entities
                  : link.data?.todoEntityId && link.data.todoEntityName
                    ? [{ entityId: link.data.todoEntityId, friendlyName: link.data.todoEntityName }]
                    : []
              }
              selectedEntityId={selectedEntityId}
              onSelect={(entityId, friendlyName) => {
                setSelectedEntityId(entityId)
                setSelectedEntityName(friendlyName)
              }}
            />
          </YStack>

          <YStack gap="$2">
            <Text fontSize={13} fontWeight="700" color={palette.ink}>
              Sens de synchronisation
            </Text>
            <YStack gap="$2">
              {(Object.keys(DIRECTION_LABELS) as HaSyncDirection[]).map((value) => (
                <DirectionRow key={value} direction={value} selected={direction === value} onPress={() => setDirection(value)} />
              ))}
            </YStack>
            <Text fontSize={12} color={palette.inkSecondary}>
              {DIRECTION_HINTS[direction]}
            </Text>
          </YStack>

          <YStack gap="$2">
            <Text fontSize={13} fontWeight="700" color={palette.ink}>
              Synchronisation
            </Text>
            <SwitchRow
              testID="ha-enabled-toggle"
              label="Synchronisation active"
              accessibilityLabel="Synchronisation active"
              value={enabled}
              onValueChange={setEnabled}
              palette={palette}
            />
            <Text fontSize={12} color={palette.inkSecondary}>
              {lastSyncLabel(link.data?.lastSyncAt ?? null, link.data?.lastError ?? null)}
            </Text>
          </YStack>

          {saveError ? (
            <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
              {saveError}
            </Text>
          ) : null}

          <YStack gap="$3" marginTop="$2">
            <XStack gap="$3" justifyContent="space-between">
              <PillButton testID="ha-save" label="Enregistrer" palette={palette} onPress={handleSave} />
              <PillButton
                testID="ha-unlink"
                label="Délier"
                tone="quiet"
                palette={palette}
                icon={(color) => <LogOutIcon size={16} color={color} />}
                onPress={() => setConfirmingUnlink(true)}
              />
            </XStack>

            <Pressable
              testID="ha-edit-connection"
              onPress={() => setStep('connect')}
              onHoverIn={editLinkHover.onHoverIn}
              onHoverOut={editLinkHover.onHoverOut}
              onPressIn={editLinkHover.onPressIn}
              onPressOut={editLinkHover.onPressOut}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Modifier la connexion"
              style={[pointerCursor, { alignSelf: 'center' }]}
            >
              <Animated.View style={{ transform: [{ scale: editLinkHover.scale }] }}>
                <Text fontSize={13} fontWeight="600" color={palette.inkSecondary} textAlign="center">
                  Modifier la connexion
                </Text>
              </Animated.View>
            </Pressable>
          </YStack>
        </FormCard>
      )}

      <ActionSheet
        visible={confirmingUnlink}
        title="Délier Home Assistant ?"
        description="La liste de courses ne sera plus synchronisée avec cette instance."
        options={[
          {
            testID: 'ha-unlink-confirm',
            label: 'Délier',
            icon: (color) => <LogOutIcon size={18} color={color} />,
            tint: palette.expiredBg,
            destructive: true,
            onPress: handleUnlink,
          },
        ]}
        onClose={() => setConfirmingUnlink(false)}
      />
    </AppShell>
  )
}
