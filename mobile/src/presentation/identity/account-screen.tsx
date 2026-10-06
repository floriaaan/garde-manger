import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { useHint } from '../shared/hint-bubble.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { LinkIcon, TrashIcon, UserIcon } from '../dashboard/dashboard-icons.js'
import { AuthField } from './auth-field.js'
import { AuthPasswordField } from './auth-password-field.js'
import { AuthButton } from './auth-button.js'
import { PocketIdIcon } from './pocket-id-icon.js'
import { GoogleIcon } from './google-icon.js'
import { Avatar } from '../shared/avatar.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useUpdateAccountNameMutation } from '../../application/identity/update-account-name.mutation.js'
import { useChangeAccountPasswordMutation } from '../../application/identity/change-account-password.mutation.js'
import { useLinkedAccountsQuery } from '../../application/identity/linked-accounts.query.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useLinkSocialMutation } from '../../application/identity/link-social.mutation.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { isFakeConnector } from '../../application/shared/connector-mode.js'

const PROVIDER_LABELS: Record<string, string> = {
  password: 'Email et mot de passe',
  pocketid: 'PocketID',
  google: 'Google',
  apple: 'Apple',
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
  const connector = useConnector()
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const session = useSessionQuery()
  const linkedAccounts = useLinkedAccountsQuery()
  const authMethods = useAuthMethodsQuery()
  const updateName = useUpdateAccountNameMutation()
  const changePassword = useChangeAccountPasswordMutation()
  const linkSocial = useLinkSocialMutation()
  const [hint, showHint] = useHint()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [nativePending, setNativePending] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false))
  }, [])

  const canChangePassword = linkedAccounts.data?.some((a) => a.provider === 'password') ?? false
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

  async function handleLinkApple() {
    setNativePending(true)
    try {
      let identityToken = 'fake'
      if (!isFakeConnector) {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        })
        if (!credential.identityToken) throw new Error('Apple n’a pas renvoyé de jeton d’identité.')
        identityToken = credential.identityToken
      }
      const result = await connector.linkApple(identityToken)
      if (!result.ok) showHint(result.error.message, 'error')
      else {
        void queryClient.invalidateQueries({ queryKey: ['linked-accounts'] })
        showHint('Compte Apple associé', 'success')
      }
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('ERR_REQUEST_CANCELED'))) {
        showHint(error instanceof Error ? error.message : 'Association Apple impossible.', 'error')
      }
    } finally {
      setNativePending(false)
    }
  }

  async function handleAddPasskey() {
    setNativePending(true)
    try {
      const result = await connector.addPasskey()
      if (!result.ok) {
        if (result.error.type !== 'ERROR_CEREMONY_ABORTED') showHint(result.error.message, 'error')
      } else {
        void queryClient.invalidateQueries({ queryKey: ['linked-accounts'] })
        showHint('Clé d’accès ajoutée', 'success')
      }
    } finally {
      setNativePending(false)
    }
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
          <Avatar name={session.data?.user.name ?? ''} image={session.data?.user.image} size={64} palette={palette} backgroundColor={palette.chipOrange} color={palette.accentWarmText} />
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
            <AuthPasswordField
              testID="account-current-password"
              label="Mot de passe actuel"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoComplete="current-password"
            />
            <AuthPasswordField
              testID="account-new-password"
              label="Nouveau mot de passe"
              value={newPassword}
              onChangeText={setNewPassword}
              autoComplete="new-password"
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
          {(appleAvailable || isFakeConnector) && authMethods.data?.some((method) => method.id === 'apple' && method.enabled) && !linkedProviders.has('apple') ? (
            <AuthButton testID="account-link-apple" label="Connecter Apple" variant="secondary" pending={nativePending} onPress={handleLinkApple} />
          ) : null}
          {authMethods.data?.some((method) => method.id === 'passkey' && method.enabled) ? (
            <AuthButton testID="account-add-passkey" label="Ajouter une clé d’accès" variant="secondary" pending={nativePending} onPress={handleAddPasskey} />
          ) : null}
        </YStack>

        <YStack marginTop="$8" gap="$2">
          <AuthButton
            testID="account-delete"
            label="Supprimer le compte"
            variant="secondary"
            icon={<TrashIcon size={16} color={palette.expiredText} />}
            onPress={() => router.push('/delete-account')}
          />
        </YStack>
      </AppShell>
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
