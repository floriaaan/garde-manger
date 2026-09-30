import { useEffect, useState } from 'react'
import { Keyboard, Switch, View } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { getTelemetry } from '../../application/shared/telemetry.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
import { AuthGardenHero, AuthScreenChrome } from '../identity/auth-screen-chrome.js'
import { AuthKeyboardAccessory, gardenColors } from '../identity/auth-garden-theme.js'
import { AuthButton } from '../identity/auth-button.js'
import { AuthError } from '../identity/auth-error.js'
import { AuthField } from '../identity/auth-field.js'
import { ClipboardIcon, QrCodeIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { InviteCodeField } from './invite-code-field.js'
import { parseInviteCode } from './join-link.js'
import { takeInviteCode } from './pending-invite.js'
import { armFirstRunTour } from './use-first-run-tour.js'
import { isCompleteInviteCode, normalizeInviteCode } from '../../domain/identity/invite-code.js'
import { useCreateHouseholdMutation } from '../../application/identity/create-household.mutation.js'
import { useJoinHouseholdMutation } from '../../application/identity/join-household.mutation.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { Result } from '../../domain/shared/result.js'
import type { Household } from '../../domain/identity/household.js'

export interface ThresholdScreenProps {
  /** Greeted by name, so the screen belongs to the account that just landed on it. */
  userName: string
  /** A code carried in by `gardemanger://join?code=…`, already validated by the route. */
  prefillCode?: string | null
  /** The gate re-reads `['household']` and moves us on; the screen never navigates itself. */
  onEnteredHousehold: () => void
  onScanCode: () => void
  onSignedOut: () => void
}

export function ThresholdScreen({
  userName,
  prefillCode,
  onEnteredHousehold,
  onScanCode,
  onSignedOut,
}: ThresholdScreenProps) {
  const palette = useSoftPalette()
  const garden = gardenColors(palette)
  const queryClient = useQueryClient()
  const [hint, showHint] = useHint()
  const [householdName, setHouseholdName] = useState('')
  const [intent, setIntent] = useState<'create' | 'join'>(prefillCode ? 'join' : 'create')
  const [showTour, setShowTour] = useState(false)
  const [code, setCode] = useState(() => normalizeInviteCode(prefillCode ?? ''))
  const create = useCreateHouseholdMutation()
  const join = useJoinHouseholdMutation()
  const signOut = useSignOutMutation()

  /**
   * A code can also arrive *after* this screen already mounted: the scanner
   * dismisses back onto it with `router.setParams`, which updates `prefillCode`
   * on an instance that is still alive rather than remounting it. The
   * `useState` initializer above only ever reads the prop's value at mount, so
   * without this the scan succeeds and the field stays exactly as empty as it
   * was — the one shape of "the QR join doesn't work" a fresh mount never
   * shows. Adjusted during render rather than in an effect (React's "reset
   * state when a prop changes" pattern) — an effect's `setCode` here would
   * commit the stale render first and then force a second one.
   */
  const [seenPrefillCode, setSeenPrefillCode] = useState(prefillCode)
  if (prefillCode !== seenPrefillCode) {
    setSeenPrefillCode(prefillCode)
    if (prefillCode) { setCode(normalizeInviteCode(prefillCode)); setIntent('join') }
  }

  /**
   * A code can also arrive *before* the account did: someone taps an invite
   * link on a phone with nobody signed in, gets sent through sign-up, and the
   * code waits in storage across that whole detour. Picked up once, on mount,
   * and only when the route did not already carry one.
   */
  useEffect(() => {
    if (prefillCode) return
    let mounted = true
    takeInviteCode().then((stored) => {
      if (mounted && stored) { setCode(stored); setIntent('join') }
    })
    return () => {
      mounted = false
    }
  }, [prefillCode])

  const busy = create.isPending || join.isPending || signOut.isPending
  const canCreate = householdName.trim().length > 0 && !busy
  const canJoin = isCompleteInviteCode(code) && !busy

  /**
   * Both mutations end the same way, and the ending is the same as the gate's
   * question: is there a household now? Seeding the answer rather than only
   * invalidating it means the redirect happens on the value we were just
   * handed, with no second round trip between the success and the dashboard.
   */
  async function settle(household: Household) {
    // Store the preference before publishing the household: the layout gate
    // can redirect as soon as the cache changes, before onEnteredHousehold.
    await armFirstRunTour(showTour)
    queryClient.setQueryData(['household'], household)
    queryClient.invalidateQueries({ queryKey: ['household'] })
    onEnteredHousehold()
  }

  /**
   * `already_in_household` is not an error the user can act on — it means a
   * foyer appeared while this screen was open (another device, a second tab,
   * an invite accepted elsewhere). Re-reading is the whole recovery, and the
   * gate takes it from there.
   */
  function isRaceNotFailure(error: ApiError) {
    if (!error) return false
    return error.type === 'already_in_household'
  }

  async function handleCreate() {
    if (!canCreate) return
    const result = await create.mutateAsync(householdName.trim())
    if (result.ok) {
      await settle(result.value)
      return
    }
    if (isRaceNotFailure(result.error)) {
      queryClient.invalidateQueries({ queryKey: ['household'] })
      onEnteredHousehold()
    }
  }

  async function handleJoin() {
    if (!canJoin) return
    const result = await join.mutateAsync(code)
    if (result.ok) {
      await settle(result.value)
      return
    }
    if (isRaceNotFailure(result.error)) {
      queryClient.invalidateQueries({ queryKey: ['household'] })
      onEnteredHousehold()
    }
  }

  async function handlePaste() {
    if (busy) return
    // `parseInviteCode`, not `normalizeInviteCode`: what people copy is the
    // whole share message, and normalizing that returns its first eight
    // letters — `REJOINSN` for a message beginning "Rejoins-nous".
    const clip = await Clipboard.getStringAsync().catch((error) => {
      getTelemetry().recordError('clipboard read failed', {
        error,
        attributes: { 'app.operation': 'identity.paste_invite' },
      })
      return ''
    })
    const parsed = parseInviteCode(clip ?? '')
    if (!parsed) {
      showHint('Presse-papier vide', 'error', { description: 'Copie d’abord le code d’invitation.' })
      return
    }
    setCode(parsed)
  }

  async function handleSignOut() {
    if (busy) return
    await signOut.mutateAsync(undefined)
    queryClient.clear()
    onSignedOut()
  }

  const createError = errorMessage(create.error, create.data, 'On n’a pas pu créer le foyer.')
  const joinError = errorMessage(join.error, join.data, 'On n’a pas pu rejoindre ce foyer.')
  // The invalid-code case belongs on the field, not only in a sentence under
  // it: the eight cells are what the user has to change.
  const codeRejected = join.data && !join.data.ok && join.data.error.type === 'invalid_invite_code'

  return (
    <AuthScreenChrome maxWidth={480} hero={<AuthGardenHero compact title={userName ? `Bienvenue, ${userName}.` : 'Bienvenue chez toi.'} subtitle="Un compte pour toi. Un garde-manger partagé avec ton foyer." />} overlay={<HintBubble hint={hint} palette={palette} />}>

      <AuthKeyboardAccessory><View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
        {(['create', 'join'] as const).map((choice) => (
          <Pressable key={choice} testID={`threshold-choose-${choice}`} accessibilityRole="tab" accessibilityState={{ selected: intent === choice, disabled: busy }} disabled={busy} onPress={() => { Keyboard.dismiss(); setIntent(choice) }} style={[pointerCursor, { flex: 1, minHeight: 50, padding: 12, borderRadius: 11, borderWidth: 1.25, borderColor: intent === choice ? garden.leaf : palette.creamPillEdge, justifyContent: 'center', alignItems: 'center', backgroundColor: intent === choice ? garden.leaf : 'transparent' }]}>
            <Text fontSize={15} fontWeight="700" textAlign="center" color={intent === choice ? garden.leafInk : palette.ink}>{choice === 'create' ? 'Créer mon foyer' : 'Rejoindre un foyer'}</Text>
          </Pressable>
        ))}
      </View></AuthKeyboardAccessory>

      <View testID="threshold-create-card" style={{ display: intent === 'create' ? 'flex' : 'none', gap: 20 }} accessibilityElementsHidden={intent !== 'create'} importantForAccessibility={intent === 'create' ? 'auto' : 'no-hide-descendants'}>
        <AuthKeyboardAccessory><YStack gap={8}>
          <Text fontSize={22} fontWeight="800" color={palette.ink}>Tout commence chez toi.</Text>
          <Text fontSize={15} color={palette.inkSecondary}>Donne un nom à ton foyer. Tu pourras ensuite inviter les autres avec un code.</Text>
        </YStack></AuthKeyboardAccessory>
        <AuthField label="Nom du foyer" placeholder="Maison Bellevue" value={householdName} onChangeText={setHouseholdName} maxLength={80} editable={!busy} testID="threshold-household-name" returnKeyType="done" onSubmitEditing={handleCreate} />
        {createError ? <AuthError message={createError} /> : null}
        <AuthButton testID="threshold-create-submit" label="Créer le foyer" pendingLabel="Création…" pending={create.isPending} disabled={!canCreate} onPress={handleCreate} />
      </View>

      <View testID="threshold-join-card" style={{ display: intent === 'join' ? 'flex' : 'none', gap: 20 }} accessibilityElementsHidden={intent !== 'join'} importantForAccessibility={intent === 'join' ? 'auto' : 'no-hide-descendants'}>
        <AuthKeyboardAccessory><YStack gap={8}>
          <Text fontSize={22} fontWeight="800" color={palette.ink}>Une place t’attend.</Text>
          <Text fontSize={15} color={palette.inkSecondary}>Saisis les huit caractères du code d’invitation, ou scanne le QR de ton foyer.</Text>
        </YStack></AuthKeyboardAccessory>
        <InviteCodeField value={code} onChangeText={setCode} onSubmit={handleJoin} invalid={Boolean(codeRejected)} disabled={busy} testID="threshold-invite-code" />
        <AuthKeyboardAccessory><XStack gap={12} flexWrap="wrap">
          <PillButton testID="threshold-paste" label="Coller le code" disabled={busy} tone="quiet" icon={(color) => <ClipboardIcon size={16} color={color} />} onPress={handlePaste} accessibilityLabel="Coller le code depuis le presse-papier" palette={palette} />
          <PillButton testID="threshold-scan" label="Scanner un QR" disabled={busy} tone="quiet" icon={(color) => <QrCodeIcon size={16} color={color} />} onPress={() => { if (!busy) onScanCode() }} palette={palette} />
        </XStack></AuthKeyboardAccessory>
        {joinError ? <AuthError message={joinError} /> : null}
        <AuthButton testID="threshold-join-submit" label="Rejoindre le foyer" pendingLabel="On te fait entrer…" pending={join.isPending} disabled={!canJoin} onPress={handleJoin} />
      </View>

      <AuthKeyboardAccessory><XStack gap={16} alignItems="center" justifyContent="space-between">
        <YStack flex={1} gap={4}>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>Me faire visiter l’app</Text>
          <Text fontSize={13} color={palette.inkSecondary}>Une courte visite, que tu peux passer.</Text>
        </YStack>
        <Switch testID="threshold-tour" accessibilityLabel="Me faire visiter l’application" value={showTour} onValueChange={setShowTour} disabled={busy} trackColor={{ false: palette.creamPillEdge, true: garden.leaf }} />
      </XStack></AuthKeyboardAccessory>
      <AuthKeyboardAccessory><YStack alignItems="center">
        <AuthButton testID="threshold-sign-out" label="Changer de compte" variant="secondary" disabled={busy} pending={signOut.isPending} onPress={handleSignOut} />
      </YStack></AuthKeyboardAccessory>
    </AuthScreenChrome>
  )
}

/**
 * A mutation here can fail two ways — the request threw (offline), or the
 * server answered with a domain error — and a screen that only reads one of
 * them goes silent on the other. `already_in_household` is filtered out on
 * purpose: it is handled as a race above, so printing it would name a problem
 * that has already resolved itself.
 */
function errorMessage(
  thrown: unknown,
  data: Result<Household, ApiError> | undefined,
  fallback: string,
): string | null {
  if (thrown) return `${fallback} Vérifie ta connexion.`
  if (data && !data.ok && data.error && data.error.type !== 'already_in_household')
    return data.error.message
  return null
}
