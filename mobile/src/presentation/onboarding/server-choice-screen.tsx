import { useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { getServerUrl, setServerUrl } from '../../application/shared/server-config.js'
import { PillButton } from '../shared/pill-button.js'
import { ArrowLeftIcon } from '../dashboard/dashboard-icons.js'
import { AuthShell } from '../identity/auth-shell.js'
import { ServerChoiceForm } from '../shared/server-choice-form.js'

export function ServerChoiceScreen({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()

  return (
    <AuthShell
      back={onBack ? <PillButton label={t('identity.back')} tone="quiet" palette={palette} onPress={onBack} icon={(color) => <ArrowLeftIcon size={16} color={color} />} /> : undefined}
      title={t('onboarding.your_server')}
      subtitle={t('onboarding.use_the_official_server_ready_to_go_or_your_own')}
    >
      <ServerChoiceForm
        palette={palette}
        defaultUrl={getServerUrl()}
        fieldLabelColor={palette.inkSecondary}
        saveLabel={t('common.use_this_server')}
        onSave={async (url) => {
          if (url !== getServerUrl()) await setServerUrl(url)
          onDone()
        }}
      />
    </AuthShell>
  )
}
