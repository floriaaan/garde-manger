import { ScanScreen } from '../presentation/fridge/scan-screen.js'
import { goBack } from '../presentation/shared/navigation.js'

/**
 * The Scanner as a sheet, for every entrance but the iPhone tab: the FAB, the
 * dashboard's buttons, the sidebar. Not `/scan` — `(tabs)` is a group, so
 * `(tabs)/scan.tsx` already owns that URL for iOS's floating tab.
 */
export default function ScannerSheet() {
  return <ScanScreen onClose={() => goBack('/')} />
}
