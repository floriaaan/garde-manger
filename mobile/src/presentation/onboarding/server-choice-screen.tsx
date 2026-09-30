import { useSoftPalette } from '../dashboard/soft-palette.js'
import { getServerUrl, setServerUrl } from '../../application/shared/server-config.js'
import { PillButton } from '../shared/pill-button.js'
import { ArrowLeftIcon } from '../dashboard/dashboard-icons.js'
import { AuthShell } from '../identity/auth-shell.js'
import { ServerChoiceForm } from '../shared/server-choice-form.js'

export function ServerChoiceScreen({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const palette = useSoftPalette()

  return (
    <AuthShell
      back={onBack ? <PillButton label="Retour" tone="quiet" palette={palette} onPress={onBack} icon={(color) => <ArrowLeftIcon size={16} color={color} />} /> : undefined}
      title="Ton serveur"
      subtitle="Utilise le serveur officiel, prêt à l'emploi, ou ton propre serveur Garde-manger."
    >
      <ServerChoiceForm
        palette={palette}
        defaultUrl={getServerUrl()}
        fieldLabelColor={palette.inkSecondary}
        saveLabel="Utiliser ce serveur"
        onSave={async (url) => {
          if (url !== getServerUrl()) await setServerUrl(url)
          onDone()
        }}
      />
    </AuthShell>
  )
}
