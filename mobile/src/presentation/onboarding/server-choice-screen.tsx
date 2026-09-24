/**
 * Between `/welcome` and `/(auth)/sign-up` on a first launch — see
 * `app/welcome.tsx` and `app/server-choice.tsx`. The radio-card + verify/save
 * form itself lives in `ServerChoiceForm` (`../shared/server-choice-form.js`),
 * shared with Réglages' "Changer de serveur" page.
 */
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { setServerUrl } from '../../application/shared/server-config.js'
import { AuthShell } from '../identity/auth-shell.js'
import { ServerChoiceForm } from '../shared/server-choice-form.js'

export function ServerChoiceScreen({ onDone }: { onDone: () => void }) {
  const palette = useSoftPalette()

  return (
    <AuthShell
      title="Choisis ton serveur"
      subtitle="Utilise le serveur officiel, prêt à l'emploi, ou ton propre serveur Garde-manger."
    >
      <ServerChoiceForm
        palette={palette}
        fieldLabelColor={palette.onDarkSecondary}
        saveLabel="Utiliser ce serveur"
        onSave={async (url) => {
          await setServerUrl(url)
          onDone()
        }}
      />
    </AuthShell>
  )
}
