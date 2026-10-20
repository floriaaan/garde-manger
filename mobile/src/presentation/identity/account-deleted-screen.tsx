import { router } from 'expo-router'
import { useTranslation } from '../../i18n/index.js'
import { AuthShell } from './auth-shell.js'
import { AuthButton } from './auth-button.js'

export function AccountDeletedScreen() {
  const { t } = useTranslation()
  return (
    <AuthShell title={t('identity.account_deleted')} subtitle={t('identity.account_deleted_confirmation')}>
      <AuthButton testID="account-deleted-sign-in" label={t('identity.sign_in')} onPress={() => router.replace('/(auth)/sign-in')} />
    </AuthShell>
  )
}
