import { useState } from 'react'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { useHint } from '../shared/hint-bubble.js'
import { goBack } from '../shared/navigation.js'
import { TrashIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthButton } from './auth-button.js'
import { AuthPasswordField } from './auth-password-field.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useLinkedAccountsQuery } from '../../application/identity/linked-accounts.query.js'
import { useDeleteAccountMutation } from '../../application/identity/delete-account.mutation.js'

export function DeleteAccountScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const household = useHouseholdQuery()
  const linkedAccounts = useLinkedAccountsQuery()
  const deleteAccount = useDeleteAccountMutation()
  const [hint, showHint] = useHint()
  const [password, setPassword] = useState('')
  const hasPassword = linkedAccounts.data?.some((account) => account.provider === 'password') ?? false
  const sharedOwner = household.data?.role === 'owner' && (household.data?.members.length ?? 0) > 1

  async function handleDelete() {
    const result = await deleteAccount.mutateAsync(hasPassword ? password : undefined)
    if (!result.ok) {
      showHint(result.error.message, 'error')
      return
    }
    queryClient.clear()
    router.replace('/(auth)/sign-in')
  }

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      hint={hint}
      header={<ScreenHeader palette={palette} icon={(color) => <TrashIcon size={19} color={color} />} title="Supprimer mon compte" onBack={() => goBack('/account')} />}
    >
      <YStack marginTop="$6" gap="$4">
        <Text fontSize={15} fontWeight="600" color={palette.ink}>
          Cette action est définitive. Ton compte et tes données personnelles seront supprimés.
        </Text>
        {household.isError || linkedAccounts.isError ? (
          <YStack gap="$2">
            <Text fontSize={14} color={palette.expiredText}>Impossible de vérifier les conditions de suppression.</Text>
            <AuthButton label="Réessayer" variant="secondary" onPress={() => {
              void household.refetch()
              void linkedAccounts.refetch()
            }} />
          </YStack>
        ) : null}
        {sharedOwner ? (
          <YStack gap="$3">
            <Text fontSize={14} color={palette.expiredText}>
              Tu es propriétaire d’un foyer avec d’autres membres. Transfère d’abord la propriété pour pouvoir supprimer ton compte.
            </Text>
            <AuthButton testID="account-go-to-household" label="Aller au foyer" onPress={() => router.push('/household')} />
          </YStack>
        ) : (
          <YStack gap="$3">
            {household.data?.role === 'owner' ? (
              <Text fontSize={14} color={palette.expiredText}>Ton foyer et son contenu seront également supprimés.</Text>
            ) : null}
            {hasPassword ? (
              <AuthPasswordField
                testID="account-delete-password"
                label="Confirme avec ton mot de passe"
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
              />
            ) : null}
            <AuthButton
              testID="account-delete-confirm"
              label="Supprimer définitivement"
              variant="secondary"
              icon={<TrashIcon size={18} color={palette.expiredText} />}
              pending={deleteAccount.isPending}
              disabled={household.isPending || household.isError || linkedAccounts.isPending || linkedAccounts.isError || (hasPassword && !password)}
              onPress={handleDelete}
            />
          </YStack>
        )}
      </YStack>
    </AppShell>
  )
}
