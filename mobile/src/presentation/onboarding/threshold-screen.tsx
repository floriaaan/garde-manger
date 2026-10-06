import { t, useTranslation } from '../../i18n/index.js'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Keyboard, Platform, Switch, View } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { haptic } from '../shared/haptics.js'
import { showToast } from '../../application/shared/toast.js'
import { getTelemetry } from '../../application/shared/telemetry.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
import { AuthGardenHero, AuthScreenChrome } from '../identity/auth-screen-chrome.js'
import { AuthKeyboardAccessory, gardenColors } from '../identity/auth-garden-theme.js'
import { AuthStep } from '../identity/auth-step.js'
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
  const { t } = useTranslation()
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
    // Confirm the real household before the gate redirects; the root toast
    // follows the member onto the dashboard without delaying that transition.
    const welcome = t('onboarding.welcome_to', { value1: household.name })
    showToast(welcome, 'success')
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(welcome)
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
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
      showHint(t('onboarding.clipboard_empty'), 'error', { description: t('onboarding.copy_the_invite_code_first') })
      return
    }
    setCode(parsed)
    showHint(t('onboarding.code_pasted'), 'success', { description: t('onboarding.all_eight_characters_are_ready_you_can_join_the_household') })
  }

  async function handleSignOut() {
    if (busy) return
    await signOut.mutateAsync(undefined)
    queryClient.clear()
    onSignedOut()
  }

  const createError = errorMessage(create.error, create.data, t('onboarding.we_couldn_t_create_the_household'))
  const joinError = errorMessage(join.error, join.data, t('onboarding.we_couldn_t_join_this_household'))
  // The invalid-code case belongs on the field, not only in a sentence under
  // it: the eight cells are what the user has to change.
  const codeRejected = join.data && !join.data.ok && join.data.error.type === 'invalid_invite_code'

  return (
    <AuthScreenChrome maxWidth={480} hero={<AuthGardenHero compact title={userName ? t('onboarding.welcome', { value1: userName }) : t('onboarding.welcome_home')} subtitle={t('onboarding.an_account_for_you_a_pantry_shared_with_your_household')} />} overlay={<HintBubble hint={hint} palette={palette} />}>

      <AuthKeyboardAccessory><View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
        {(['create', 'join'] as const).map((choice) => (
          <Pressable key={choice} testID={`threshold-choose-${choice}`} accessibilityRole="tab" accessibilityState={{ selected: intent === choice, disabled: busy }} disabled={busy} onPress={() => { Keyboard.dismiss(); setIntent(choice) }} style={[pointerCursor, { flex: 1, minHeight: 50, padding: 12, borderRadius: 11, borderWidth: 1.25, borderColor: intent === choice ? garden.leaf : palette.creamPillEdge, justifyContent: 'center', alignItems: 'center', backgroundColor: intent === choice ? garden.leaf : 'transparent' }]}>
            <Text fontSize={15} fontWeight="700" textAlign="center" color={intent === choice ? garden.leafInk : palette.ink}>{choice === 'create' ? t('onboarding.create_my_household') : t('onboarding.join_a_household')}</Text>
          </Pressable>
        ))}
      </View></AuthKeyboardAccessory>

      <AuthStep testID="threshold-create-card" active={intent === 'create'} direction={-1} style={{ gap: 20 }}>
        <AuthKeyboardAccessory><YStack gap={8}>
          <Text fontSize={22} fontWeight="800" color={palette.ink}>{t('onboarding.it_all_starts_at_home')}</Text>
          <Text fontSize={15} color={palette.inkSecondary}>{t('onboarding.name_your_household_then_invite_others_with_a_code')}</Text>
        </YStack></AuthKeyboardAccessory>
        <AuthField label={t('identity.household_name')} placeholder={t('onboarding.bellevue_house')} value={householdName} onChangeText={setHouseholdName} maxLength={80} editable={!busy} testID="threshold-household-name" returnKeyType="done" onSubmitEditing={handleCreate} />
        {createError ? <AuthError message={createError} /> : null}
        <AuthButton testID="threshold-create-submit" label={t('onboarding.create_household')} pendingLabel={t('onboarding.creating')} pending={create.isPending} disabled={!canCreate} onPress={handleCreate} />
      </AuthStep>

      <AuthStep testID="threshold-join-card" active={intent === 'join'} direction={1} style={{ gap: 20 }}>
        <AuthKeyboardAccessory><YStack gap={8}>
          <Text fontSize={22} fontWeight="800" color={palette.ink}>{t('onboarding.there_s_a_place_for_you')}</Text>
          <Text fontSize={15} color={palette.inkSecondary}>{t('onboarding.enter_the_eight_character_invite_code_or_scan_your_household')}</Text>
        </YStack></AuthKeyboardAccessory>
        <InviteCodeField value={code} onChangeText={setCode} onSubmit={handleJoin} invalid={Boolean(codeRejected)} disabled={busy} testID="threshold-invite-code" />
        <AuthKeyboardAccessory><XStack gap={12} flexWrap="wrap">
          <PillButton testID="threshold-paste" label={t('onboarding.paste_code')} disabled={busy} tone="quiet" icon={(color) => <ClipboardIcon size={16} color={color} />} onPress={handlePaste} accessibilityLabel={t('onboarding.paste_code_from_clipboard')} palette={palette} />
          <PillButton testID="threshold-scan" label={t('onboarding.scan_a_qr')} disabled={busy} tone="quiet" icon={(color) => <QrCodeIcon size={16} color={color} />} onPress={() => { if (!busy) onScanCode() }} palette={palette} />
        </XStack></AuthKeyboardAccessory>
        {joinError ? <AuthError message={joinError} /> : null}
        <AuthButton testID="threshold-join-submit" label={t('onboarding.join_household')} pendingLabel={t('onboarding.letting_you_in')} pending={join.isPending} disabled={!canJoin} onPress={handleJoin} />
      </AuthStep>

      <AuthKeyboardAccessory><XStack gap={16} alignItems="center" justifyContent="space-between">
        <YStack flex={1} gap={4}>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>{t('onboarding.show_me_around_the_app')}</Text>
          <Text fontSize={13} color={palette.inkSecondary}>{t('onboarding.a_short_tour_that_you_can_skip')}</Text>
        </YStack>
        <Switch testID="threshold-tour" accessibilityLabel={t('onboarding.show_me_around_the_application')} value={showTour} onValueChange={setShowTour} disabled={busy} trackColor={{ false: palette.creamPillEdge, true: garden.leaf }} />
      </XStack></AuthKeyboardAccessory>
      <AuthKeyboardAccessory><YStack alignItems="center">
        <AuthButton testID="threshold-sign-out" label={t('onboarding.switch_accounts')} variant="secondary" disabled={busy} pending={signOut.isPending} onPress={handleSignOut} />
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
  if (thrown) return t('identity.check_your_connection', { value1: fallback })
  if (data && !data.ok && data.error && data.error.type !== 'already_in_household')
    return data.error.message
  return null
}
