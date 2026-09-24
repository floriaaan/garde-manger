import { router } from 'expo-router'
import { InviteScannerScreen } from '../../presentation/onboarding/invite-scanner-screen.js'
import { goBack } from '../../presentation/shared/navigation.js'

export default function ScanInviteCodeScreen() {
  return (
    <InviteScannerScreen
      onScanned={(code) => {
        // Back onto the threshold that pushed us, with the code set as a
        // parameter — not `replace` into a fresh copy, which would discard the
        // foyer name someone may already have typed on the card above.
        //
        // `dismissTo`, not `back()` + `setParams()`: the pop is async, so the
        // `setParams` that followed it landed on whichever route was still
        // focused — the scanner being torn down — and the threshold underneath
        // never saw the code. One call pops *and* carries the parameter.
        router.dismissTo({ pathname: '/(onboarding)', params: { code } })
      }}
      onClose={() => goBack('/(onboarding)')}
    />
  )
}
