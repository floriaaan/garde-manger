import { useRef } from 'react'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { YStack } from '../shared/tamagui-typed.js'
import { CameraPermissionModal } from '../shared/camera-permission-modal.js'
import { goBack } from '../shared/navigation.js'
import { CameraChrome } from '../shared/camera-chrome.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { getTelemetry } from '../../application/shared/telemetry.js'

type BarcodeScannerMode = ({ mode: 'create' } | { mode: 'edit'; productId: string }) & {
  // True when the scanner was pushed from a form that's already open (the form's own
  // "Scanner un code-barres" button) — as opposed to a fresh scan from the dashboard/sidebar
  // where no form exists yet. Determines how a scanned barcode is delivered back: dismiss
  // onto the existing form instance vs. open a brand-new one.
  fromForm?: boolean
}

export function BarcodeScannerScreen(props: BarcodeScannerMode) {
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  // A ref, not state: `onBarcodeScanned` can fire multiple times before a state update
  // commits a re-render, so several calls could all observe `handled === false` and all
  // navigate. A ref is read/written synchronously, so only the first call ever proceeds.
  const handledRef = useRef(false)

  function handleBarcodeScanned({ data }: { data: string }) {
    if (handledRef.current) return
    handledRef.current = true

    if (props.fromForm) {
      // A form is already open underneath the scanner in the stack — dismiss back onto it
      // and update its `prefillBarcode` param, rather than opening a new form instance
      // (which would discard whatever the user had already typed there).
      //
      // `dismissTo`, not `back()` + `setParams()`: the pop is async, so the
      // `setParams` that followed it landed on the scanner being torn down
      // rather than the form underneath, and the scan never arrived.
      router.dismissTo(
        props.mode === 'edit'
          ? { pathname: '/(tabs)/fridge/[id]/edit', params: { id: props.productId, prefillBarcode: data } }
          : { pathname: '/(tabs)/fridge/new', params: { prefillBarcode: data } },
      )
      return
    }

    if (props.mode === 'edit') {
      router.replace({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: props.productId, prefillBarcode: data } })
      return
    }
    
    try {
      router.replace({ pathname: '/(tabs)/fridge/new', params: { prefillBarcode: data } })
    } catch (error) {
      // If router.replace fails (empty stack case), fall back to home route
      getTelemetry().recordError('barcode scan navigation failed', {
        error,
        attributes: { 'app.operation': 'fridge.barcode_scan_navigate' },
      })
      router.replace('/(tabs)/fridge')
    }
  }

  if (!permission?.granted) {
    return (
      <CameraPermissionModal
        palette={palette}
        message="L'accès à la caméra est nécessaire pour scanner un code-barres."
        canAskAgain={permission?.canAskAgain ?? true}
        onRequestPermission={requestPermission}
        onClose={() => goBack('/(tabs)/fridge')}
        requestTestID="barcode-scanner-request-permission"
        closeTestID="barcode-scanner-permission-close"
      />
    )
  }

  return (
    <YStack flex={1}>
      <CameraView
        testID="fridge-barcode-camera"
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <CameraChrome
        palette={palette}
        guide="barcode"
        hint="Vise le code-barres, il se lit tout seul"
        onClose={() => goBack('/(tabs)/fridge')}
        closeTestID="barcode-scanner-close"
      />
    </YStack>
  )
}
