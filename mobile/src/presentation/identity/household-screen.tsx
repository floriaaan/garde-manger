import { useTranslation, getLocale } from '../../i18n/index.js'
/*
 * The foyer, finally visible.
 *
 * PRODUCT.md's first principle is "le foyer est l'unité de vérité, jamais
 * l'utilisateur seul", and it is the differentiator named as structuring
 * against the single-user shopping-list apps. The UI had no surface for it
 * at all: no member list, no invite, no attribution, and a household name
 * hardcoded to a fixture — every deployment showed every user the same
 * "Foyer Leroux". The backend has shipped /api/households since phase 1.
 *
 * The invite code is the whole onboarding path for the second member, so it
 * is the loudest thing on the screen for an owner and simply absent for a
 * member (the API omits it for anyone but the owner, which is what the UI
 * gates on — never on the role string alone).
 */
import { useState } from 'react'
import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { useHint } from '../shared/hint-bubble.js'
import { goBack } from '../shared/navigation.js'
import { PillButton } from '../shared/pill-button.js'
import { Avatar } from '../shared/avatar.js'
import { pointerCursor } from '../shared/hover.js'
import { AuthButton } from './auth-button.js'
import { InviteShareCard } from './invite-share-card.js'
import { ROLE_LABELS } from './role-labels.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ArrowLeftRightIcon, HomeIcon, LogOutIcon, UsersIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { IdentityCard } from '../settings/identity-card.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useRenameHouseholdMutation } from '../../application/identity/rename-household.mutation.js'
import { AuthField } from './auth-field.js'
import { useRegenerateInviteCodeMutation } from '../../application/identity/regenerate-invite-code.mutation.js'
import { useRemoveHouseholdMemberMutation } from '../../application/identity/remove-household-member.mutation.js'
import { useLeaveHouseholdMutation } from '../../application/identity/leave-household.mutation.js'
import { useTransferHouseholdOwnershipMutation } from '../../application/identity/transfer-household-ownership.mutation.js'
import { useHaLinkQuery } from '../../application/home-assistant/ha-link.query.js'
import type { HouseholdMember } from '../../domain/identity/household.js'

export function HouseholdScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const household = useHouseholdQuery()
  const session = useSessionQuery()
  const regenerate = useRegenerateInviteCodeMutation()
  const rename = useRenameHouseholdMutation()
  const removeMember = useRemoveHouseholdMemberMutation()
  const leave = useLeaveHouseholdMutation()
  const transferOwnership = useTransferHouseholdOwnershipMutation()
  const haLink = useHaLinkQuery()
  const [hint, showHint] = useHint()
  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [transferPickerOpen, setTransferPickerOpen] = useState(false)

  const data = household.data
  const isOwner = data?.role === 'owner'
  const currentUserId = session.data?.user.id

  async function handleRegenerate() {
    const result = await regenerate.mutateAsync(undefined)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['household'] })
    showHint(t('identity.new_code_generated'), 'success', { description: t('identity.the_old_code_no_longer_works') })
  }

  async function handleRename(name: string) {
    if (!name) {
      showHint(t('identity.the_name_can_t_be_empty'), 'error')
      return
    }
    const result = await rename.mutateAsync(name)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['household'] })
    showHint(t('identity.household_renamed'), 'success', { description: t('identity.all_members_see_the_new_name') })
  }

  async function handleRemove(member: HouseholdMember) {
    setMemberToRemove(null)
    const result = await removeMember.mutateAsync(member.userId)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['household'] })
    showHint(t('identity.is_no_longer_part_of_the_household', { value1: member.name }), 'success')
  }

  async function handleLeave() {
    setConfirmLeave(false)
    if (isOwner) return
    const result = await leave.mutateAsync(undefined)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    // Not sign-in. Leaving a foyer is not leaving the account — the session
    // is untouched, and the account is now exactly what a brand-new one is:
    // signed in, with no foyer. That is the onboarding's state, and the
    // `(tabs)` gate would bounce us there anyway; going straight avoids a
    // frame of dashboard belonging to a household that no longer exists.
    queryClient.clear()
    router.replace('/(onboarding)')
  }

  async function handleTransfer(member: HouseholdMember) {
    setTransferPickerOpen(false)
    const result = await transferOwnership.mutateAsync(member.userId)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['household'] })
    showHint(t('identity.owns_the_household', { value1: member.name }), 'success', { description: t('identity.you_remain_a_member') })
  }

  const refresh = usePullToRefresh(() => household.refetch())

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <UsersIcon size={19} color={color} />}
      title={t('identity.household')}
      subtitle={data ? t('identity.member_2', { count: data.members.length }) : undefined}
      onBack={() => goBack('/settings')}
    />
  )

  if (!data) {
    return (
      <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={header}>
        <YStack marginTop="$5" gap="$3" alignItems="flex-start">
          {/* Three states, not two. "Tu n'appartiens à aucun foyer" is a fact
              about the account; printing it for a failed read tells someone
              their foyer is gone, and offers nothing to do about it. */}
          <Text
            fontSize={14}
            fontWeight="500"
            color={household.isError ? palette.expiredText : palette.inkSecondary}
          >
            {household.isPending
              ? t('identity.loading_household')
              : household.isError
                ? t('identity.we_couldn_t_load_your_household_check_your_connection')
                : t('identity.you_don_t_belong_to_a_household')}
          </Text>
          {household.isError ? (
            <PillButton
              testID="household-retry"
              label={t('dashboard.try_again')}
              accessibilityLabel={t('identity.try_loading_the_household_again')}
              onPress={() => household.refetch()}
              palette={palette}
            />
          ) : null}
        </YStack>
      </AppShell>
    )
  }

  return (
    <>
    <AppShell nav={{ kind: 'stack' }} hint={hint} refresh={refresh} header={header}>

      {/* The header's title is generic ("Foyer", same convention as every
          other screen) — the custom household name still needs to be shown
          somewhere, to every member, not just the owner viewing the invite
          card below. */}
      {/* `role="heading"`: VoiceOver/TalkBack's heading rotor
          picks this up alongside the screen's own title instead of reading
          it as an anonymous text block unrelated to "Foyer" above it
          (2026-09-10 audit). */}
      <Text testID="household-name" fontSize={13} fontWeight="600" color={palette.inkSecondary} role="heading">
        {data.name}
      </Text>

      {isOwner ? (
        <HouseholdNameEditor initialName={data.name} pending={rename.isPending} onSave={handleRename} />
      ) : null}

      {data.inviteCode ? (
        <InviteShareCard
          householdName={data.name}
          inviteCode={data.inviteCode}
          palette={palette}
          regenerating={regenerate.isPending}
          onRegenerate={handleRegenerate}
          onFeedback={showHint}
        />
      ) : null}

      <YStack marginTop="$6" gap="$2">
        <Text fontSize={15} fontWeight="800" color={palette.ink}>{t('identity.members')}</Text>
        {data.members.map((member) => (
          <MemberRow
            key={member.userId}
            member={member}
            isSelf={member.userId === currentUserId}
            canRemove={isOwner && member.userId !== currentUserId}
            onRemove={() => setMemberToRemove(member)}
            palette={palette}
          />
        ))}
      </YStack>

      {isOwner ? (
        <YStack marginTop="$8" gap="$2">
          <Text fontSize={15} fontWeight="800" color={palette.ink}>{t('identity.connected_home')}</Text>
          {/* Same card style as the Foyer button on Réglages (2026-09-09 ask):
              an `IdentityCard`, not the bespoke mintPale row this used to be. */}
          <IdentityCard
            testID="ha-settings-row"
            bg={palette.mintPale}
            labelColor={palette.mintPaleText}
            chipColor={palette.chipTeal}
            icon={<HomeIcon size={18} color={palette.onDark} />}
            label={t('home-assistant.home_assistant')}
            value={haLink.data?.configured && haLink.data.todoEntityName ? haLink.data.todoEntityName : t('identity.not_configured')}
            secondary={t('identity.keep_your_shopping_list_in_sync_with_home_assistant')}
            corner="b"
            palette={palette}
            onPress={() => router.push('/home-assistant')}
            accessibilityLabel={t('identity.home_assistant', { value1: haLink.data?.configured && haLink.data.todoEntityName ? haLink.data.todoEntityName : t('identity.not_configured') })}
          />
        </YStack>
      ) : null}

      {isOwner && data.members.length > 1 ? (
        <YStack marginTop="$8">
          <AuthButton
            testID="household-transfer-ownership"
            label={t('identity.transfer_ownership')}
            variant="secondary"
            icon={<ArrowLeftRightIcon size={16} color={palette.ink} />}
            onPress={() => setTransferPickerOpen(true)}
          />
        </YStack>
      ) : null}

      {!isOwner ? (
        <YStack marginTop="$4">
          <AuthButton
            testID="household-leave"
            label={t('identity.leave_household')}
            variant="secondary"
            icon={<LogOutIcon size={16} color={palette.ink} />}
            onPress={() => setConfirmLeave(true)}
          />
        </YStack>
      ) : null}
    </AppShell>

    <ActionSheet
      visible={memberToRemove !== null}
      onClose={() => setMemberToRemove(null)}
      title={memberToRemove ? t('fridge.remove_2', { value1: memberToRemove.name }) : undefined}
      description={t('identity.this_person_will_lose_access_to_the_household_s_pantry')}
      options={
        memberToRemove
          ? [
              {
                testID: 'household-remove-confirm',
                label: t('identity.remove_from_household'),
                icon: (color) => <XIcon size={18} color={color} />,
                tint: palette.expired,
                destructive: true,
                onPress: () => handleRemove(memberToRemove),
              },
            ]
          : []
      }
    />

    <ActionSheet
      visible={transferPickerOpen}
      onClose={() => setTransferPickerOpen(false)}
      title={t('identity.transfer_ownership')}
      description={t('identity.choose_who_will_own_the_household_you_ll_remain_a')}
      options={[]}
    >
      <YStack gap="$2">
        {data.members
          .filter((member) => member.userId !== currentUserId)
          .map((member) => (
            <Pressable
              key={member.userId}
              testID={`household-transfer-target-${member.userId}`}
              onPress={() => handleTransfer(member)}
              accessibilityRole="button"
              accessibilityLabel={t('identity.transfer_ownership_to', { value1: member.name })}
              style={pointerCursor}
            >
              <XStack
                alignItems="center"
                gap="$3"
                backgroundColor={palette.gradientBottom}
                borderRadius={16}
                padding="$3"
                minHeight={44}
              >
                <Avatar name={member.name} image={member.image} palette={palette} />
                <Text fontSize={14} fontWeight="700" color={palette.ink} flex={1}>
                  {member.name}
                </Text>
              </XStack>
            </Pressable>
          ))}
      </YStack>
    </ActionSheet>

    <ActionSheet
      visible={confirmLeave && !isOwner}
      onClose={() => setConfirmLeave(false)}
      title={t('identity.leave_household_2')}
      description={t('identity.you_ll_lose_access_to_the_household_s_pantry_shopping')}
      options={[
        {
          testID: 'household-leave-confirm',
          label: t('identity.leave_household'),
          icon: (color) => <LogOutIcon size={18} color={color} />,
          tint: palette.expired,
          destructive: true,
          onPress: handleLeave,
        },
      ]}
    />
    </>
  )
}

function MemberRow({
  member,
  isSelf,
  canRemove,
  onRemove,
  palette,
}: {
  member: HouseholdMember
  isSelf: boolean
  canRemove: boolean
  onRemove: () => void
  palette: SoftPalette
}) {
  const { t } = useTranslation()
  return (
    <XStack
      testID={`household-member-${member.userId}`}
      alignItems="center"
      gap="$3"
      backgroundColor={palette.gradientBottom}
      borderRadius={16}
      padding="$3"
      minHeight={56}
      style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 }}
    >
      <Avatar name={member.name} image={member.image} palette={palette} />
      <YStack flex={1}>
        <Text fontSize={14} fontWeight="700" color={palette.ink}>
          {member.name}
          {isSelf ? ' (toi)' : ''}
        </Text>
        <Text fontSize={12} fontWeight="500" color={palette.inkSecondary}>{t('identity.since', { value1: ROLE_LABELS[member.role], value2: new Date(member.joinedAt).toLocaleDateString(getLocale()) })}</Text>
      </YStack>
      {canRemove ? (
        <Pressable
          testID={`household-remove-${member.userId}`}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('identity.remove_from_household_2', { value1: member.name })}
          style={pointerCursor}
        >
          <XStack alignItems="center" minHeight={44} paddingHorizontal="$3" borderRadius={999} backgroundColor={palette.expiredBg}>
            <Text fontSize={12} fontWeight="700" color={palette.expiredText}>{t('fridge.remove')}</Text>
          </XStack>
        </Pressable>
      ) : null}
    </XStack>
  )
}

// Own component so `name` seeds from `initialName` once, at mount — same
// pattern as the account screen's `NameEditor`.
function HouseholdNameEditor({
  initialName,
  pending,
  onSave,
}: {
  initialName: string
  pending: boolean
  onSave: (trimmed: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  return (
    <YStack marginTop="$4" gap="$2">
      <AuthField testID="household-rename-field" label={t('identity.household_name')} value={name} onChangeText={setName} autoCapitalize="words" />
      <AuthButton
        testID="household-rename-save"
        label={t('identity.rename')}
        pending={pending}
        disabled={!name.trim() || name.trim() === initialName}
        onPress={() => onSave(name.trim())}
      />
    </YStack>
  )
}
