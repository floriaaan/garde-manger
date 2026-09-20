import { useState } from 'react'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { useHint } from '../shared/hint-bubble.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { LockIcon, LinkIcon, TrashIcon, UserIcon } from '../dashboard/dashboard-icons.js'
import { AuthField } from './auth-field.js'
import { AuthButton } from './auth-button.js'
import { PocketIdIcon } from './pocket-id-icon.js'
import { GoogleIcon } from './google-icon.js'
import { initials } from '../shared/member-avatars.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useUpdateAccountNameMutation } from '../../application/identity/update-account-name.mutation.js'
import { useChangeAccountPasswordMutation } from '../../application/identity/change-account-password.mutation.js'
import { useLinkedAccountsQuery } from '../../application/identity/linked-accounts.query.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useLinkSocialMutation } from '../../application/identity/link-social.mutation.js'
import { useDeleteAccountMutation } from '../../application/identity/delete-account.mutation.js'

const PROVIDER_LABELS: Record<string, string> = {
  password: 'Email et mot de passe',
  pocketid: 'PocketID',
  google: 'Google',
  passkey: 'Clé d’accès (passkey)',
}

function ProviderIcon({ provider, color }: { provider: string; color: string }) {
  switch (provider) {
    case 'pocketid':
      return <PocketIdIcon size={17} />
    case 'google':
      return <GoogleIcon size={17} />
    default:
      return <LinkIcon size={17} color={color} />
  }
}

export function AccountScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const session = useSessionQuery()
  const household = useHouseholdQuery()
  const linkedAccounts = useLinkedAccountsQuery()
  const authMethods = useAuthMethodsQuery()
  const updateName = useUpdateAccountNameMutation()
  const changePassword = useChangeAccountPasswordMutation()
  const linkSocial = useLinkSocialMutation()
  const deleteAccount = useDeleteAccountMutation()
  const [hint, showHint] = useHint()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false)
  const [deleteBlockedOpen, setDeleteBlockedOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  const canChangePassword = linkedAccounts.data?.some((a) => a.provider === 'password') ?? false
  const isOwnerOfSharedHousehold = household.data?.role === 'owner' && (household.data?.members.length ?? 0) > 1
  const linkedProviders = new Set((linkedAccounts.data ?? []).map((a) => a.provider))
  const linkableMethods = (authMethods.data ?? []).filter(
    (m): m is typeof m & { id: 'pocketid' | 'google' } =>
      m.enabled && (m.id === 'pocketid' || m.id === 'google') && !linkedProviders.has(m.id),
  )

  async function handleLinkSocial(provider: 'pocketid' | 'google') {
    const result = await linkSocial.mutateAsync(provider)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['linked-accounts'] })
  }

  async function handleSaveName(trimmed: string) {
    if (!trimmed) {
      showHint('Le nom ne peut pas être vide.', 'error')
      return
    }
    const result = await updateName.mutateAsync(trimmed)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['session'] })
    showHint('Nom mis à jour', 'success')
  }

  async function handleChangePassword() {
    const result = await changePassword.mutateAsync({ currentPassword, newPassword })
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    showHint('Mot de passe mis à jour', 'success', { description: 'Utilise-le à ta prochaine connexion.' })
  }

  function handleRequestDelete() {
    if (isOwnerOfSharedHousehold) {
      setDeleteBlockedOpen(true)
      return
    }
    setDeleteSheetOpen(true)
  }

  async function handleConfirmDelete() {
    const result = await deleteAccount.mutateAsync(canChangePassword ? deletePassword : undefined)
    if (!result.ok) {
      setDeleteSheetOpen(false)
      showHint(result.error.message, 'error')
      return
    }
    setDeleteSheetOpen(false)
    queryClient.clear()
    router.replace('/(auth)/sign-in')
  }

  return (
    <>
      <AppShell
        nav={{ kind: 'stack' }}
        hint={hint}
        header={
          <ScreenHeader
            palette={palette}
            icon={(color) => <UserIcon size={19} color={color} />}
            title="Mon compte"
            onBack={() => goBack('/settings')}
          />
        }
      >
        <YStack marginTop="$5" alignItems="center" gap="$2">
          <YStack width={64} height={64} borderRadius={999} backgroundColor={palette.chipOrange} alignItems="center" justifyContent="center">
            <Text fontSize={22} fontWeight="800" color={palette.onDark}>
              {initials(session.data?.user.name || '?')}
            </Text>
          </YStack>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
            {session.data?.user.email}
          </Text>
        </YStack>

        {session.data ? (
          <NameEditor
            palette={palette}
            initialName={session.data.user.name}
            pending={updateName.isPending}
            onSave={handleSaveName}
          />
        ) : null}

        {canChangePassword ? (
          <YStack marginTop="$8" gap="$2">
            <Text fontSize={15} fontWeight="800" color={palette.ink}>
              Mot de passe
            </Text>
            <AuthField
              testID="account-current-password"
              label="Mot de passe actuel"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <AuthField
              testID="account-new-password"
              label="Nouveau mot de passe"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <AuthButton
              testID="account-save-password"
              label="Changer le mot de passe"
              pending={changePassword.isPending}
              disabled={!currentPassword || !newPassword}
              onPress={handleChangePassword}
            />
          </YStack>
        ) : null}

        <YStack marginTop="$8" gap="$2">
          <Text fontSize={15} fontWeight="800" color={palette.ink}>
            Méthodes de connexion
          </Text>
          {(linkedAccounts.data ?? []).map((account) => (
            <XStack
              key={account.provider}
              alignItems="center"
              gap="$3"
              backgroundColor={palette.gradientBottom}
              borderRadius={16}
              padding="$3"
              minHeight={44}
            >
              <YStack width={36} height={36} borderRadius={12} backgroundColor={palette.chipViolet} alignItems="center" justifyContent="center">
                <ProviderIcon provider={account.provider} color={palette.onDark} />
              </YStack>
              <Text fontSize={14} fontWeight="700" color={palette.ink} flex={1}>
                {PROVIDER_LABELS[account.provider] ?? account.provider}
              </Text>
            </XStack>
          ))}
          {linkableMethods.map((method) => (
            <AuthButton
              key={method.id}
              testID={`account-link-${method.id}`}
              label={`Connecter ${PROVIDER_LABELS[method.id] ?? method.label}`}
              variant="secondary"
              icon={<ProviderIcon provider={method.id} color={palette.ink} />}
              pending={linkSocial.isPending}
              onPress={() => handleLinkSocial(method.id)}
            />
          ))}
        </YStack>

        <YStack marginTop="$8" gap="$2">
          <AuthButton
            testID="account-delete"
            label="Supprimer le compte"
            variant="secondary"
            icon={<TrashIcon size={16} color={palette.expiredText} />}
            disabled={household.isLoading}
            onPress={handleRequestDelete}
          />
        </YStack>
      </AppShell>

      <ActionSheet
        visible={deleteBlockedOpen}
        onClose={() => setDeleteBlockedOpen(false)}
        title="Transfère la propriété du foyer d'abord"
        description="Tu es propriétaire d'un foyer avec d'autres membres. Transfère la propriété avant de supprimer ton compte."
        options={[
          {
            testID: 'account-go-to-household',
            label: 'Aller au foyer',
            icon: (color) => <LockIcon size={18} color={color} />,
            tint: palette.chipViolet,
            onPress: () => {
              setDeleteBlockedOpen(false)
              router.push('/household')
            },
          },
        ]}
      />

      <ActionSheet
        visible={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        title="Supprimer le compte ?"
        description="Cette action est irréversible et supprime toutes tes données personnelles."
        options={[
          {
            testID: 'account-delete-confirm',
            label: 'Supprimer définitivement',
            icon: (color) => <TrashIcon size={18} color={color} />,
            tint: palette.expired,
            destructive: true,
            onPress: handleConfirmDelete,
          },
        ]}
      >
        {canChangePassword ? (
          <AuthField
            testID="account-delete-password"
            label="Confirme avec ton mot de passe"
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
          />
        ) : null}
      </ActionSheet>
    </>
  )
}

// A separate component so `name` initializes from `initialName` only once,
// at mount — mounting this only once `session.data` exists (see call site)
// means that initial value is never the pre-load empty string.
function NameEditor({
  palette,
  initialName,
  pending,
  onSave,
}: {
  palette: ReturnType<typeof useSoftPalette>
  initialName: string
  pending: boolean
  onSave: (trimmed: string) => void
}) {
  const [name, setName] = useState(initialName)
  return (
    <YStack marginTop="$6" gap="$2">
      <AuthField testID="account-name" label="Nom" value={name} onChangeText={setName} autoCapitalize="words" />
      <AuthButton
        testID="account-save-name"
        label="Enregistrer"
        pending={pending}
        disabled={name.trim() === initialName}
        onPress={() => onSave(name.trim())}
      />
    </YStack>
  )
}
