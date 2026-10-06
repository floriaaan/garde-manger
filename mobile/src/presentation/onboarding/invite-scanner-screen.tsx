import { useTranslation } from '../../i18n/index.js'
/*
 * The QR half of "on m'a donné un code".
 *
 * Same shape as `barcode-scanner-screen.tsx` — full-bleed camera, one close
 * glyph on its own scrim, a ref rather than state so a burst of scans only
 * navigates once — with two differences that matter: it reads `qr` instead of
 * the product barcode types, and it hands its result back through a route
 * parameter rather than opening a new screen, because the threshold that
 * pushed it is still mounted underneath with a half-typed code on it.
 *
 * A QR that is not one of ours is a no-op, not an error: pointing a camera at
 * a poster and getting a red banner teaches nothing. The frame simply keeps
 * looking until an eight-character code passes.
 */
import { useRef } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { CameraPermissionModal } from '../shared/camera-permission-modal.js'
import { XIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { parseInviteCode } from './join-link.js'

export function InviteScannerScreen({
  onScanned,
  onClose,
}: {
  onScanned: (code: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  const handledRef = useRef(false)

  function handleBarcodeScanned({ data }: { data: string }) {
    if (handledRef.current) return
    const code = parseInviteCode(data)
    // Not `handled = true` before the parse: a poster's QR must not consume
    // the scanner's one shot and leave the frame permanently inert.
    if (!code) return
    handledRef.current = true
    onScanned(code)
  }

  if (!permission?.granted) {
    return (
      <CameraPermissionModal
        palette={palette}
        message={t('onboarding.camera_access_is_required_to_scan_the_invite_qr_code')}
        canAskAgain={permission?.canAskAgain ?? true}
        onRequestPermission={requestPermission}
        onClose={onClose}
        requestTestID="invite-scanner-request-permission"
        closeTestID="invite-scanner-permission-close"
      />
    )
  }

  return (
    <YStack flex={1}>
      <CameraView
        testID="invite-qr-camera"
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Pressable
          testID="invite-scanner-close"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.close_scanner')}
          style={[pointerCursor, { padding: 12 }]}
        >
          <YStack
            width={48}
            height={48}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={palette.cameraScrim}
          >
            <XIcon size={22} color={palette.onDark} />
          </YStack>
        </Pressable>
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        {/* One line, on the same scrim the close glyph uses, because a camera
            frame is the one surface in this app whose background is unknown. */}
        <YStack alignItems="center" padding="$4">
          <YStack backgroundColor={palette.cameraScrim} borderRadius={999} paddingVertical="$2" paddingHorizontal="$4">
            <Text fontSize={13} fontWeight="600" color={palette.onDark}>{t('onboarding.point_at_the_qr_code_on_the_household_screen')}</Text>
          </YStack>
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}
