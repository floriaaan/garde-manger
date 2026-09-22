import { useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { CameraPermissionModal } from '../shared/camera-permission-modal.js'
import { goBack } from '../shared/navigation.js'
import { FileTextIcon, ImageIcon } from '../dashboard/dashboard-icons.js'
import { CameraChrome, CameraRoundButton, ShutterButton } from '../shared/camera-chrome.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export function ReceiptScannerScreen() {
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [capturing, setCapturing] = useState(false)

  function goToReview(imageUri: string) {
    router.replace({ pathname: '/receipts/review', params: { imageUri } })
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 })
      if (photo?.uri) goToReview(photo.uri)
    } finally {
      setCapturing(false)
    }
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) goToReview(result.assets[0].uri)
  }

  // A mailed or emailed receipt has no paper to photograph — the file
  // picker is the only way in for those, alongside the camera and gallery.
  async function handlePickPdf() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (!result.canceled && result.assets[0]) goToReview(result.assets[0].uri)
  }

  if (!permission?.granted) {
    return (
      <CameraPermissionModal
        palette={palette}
        message="L'accès à la caméra est nécessaire pour scanner un ticket de caisse."
        canAskAgain={permission?.canAskAgain ?? true}
        onRequestPermission={requestPermission}
        onClose={() => goBack('/receipts')}
        requestTestID="receipt-scanner-request-permission"
        closeTestID="receipt-scanner-permission-close"
      >
        <Pressable
          testID="receipt-scanner-gallery-fallback"
          onPress={handlePickFromGallery}
          accessibilityRole="button"
          accessibilityLabel="Choisir une photo dans la galerie"
          style={pointerCursor}
        >
          <Text fontSize={13} fontWeight="700" color={palette.mintPaleText} textAlign="center">
            Choisir une photo dans la galerie
          </Text>
        </Pressable>
        <Pressable
          testID="receipt-scanner-pdf-fallback"
          onPress={handlePickPdf}
          accessibilityRole="button"
          accessibilityLabel="Importer un ticket au format PDF"
          style={pointerCursor}
        >
          <Text fontSize={13} fontWeight="700" color={palette.mintPaleText} textAlign="center">
            Importer un PDF
          </Text>
        </Pressable>
      </CameraPermissionModal>
    )
  }

  return (
    <YStack flex={1}>
      <CameraView testID="receipt-scanner-camera" ref={cameraRef} style={{ flex: 1 }} />
      {/* A framing guide and one instruction: a badly-framed shot is the
          extraction's main failure mode, and nothing used to guide it. */}
      <CameraChrome
        palette={palette}
        guide="receipt"
        hint="Cadre le ticket entier, bien à plat"
        onClose={() => goBack('/receipts')}
        closeTestID="receipt-scanner-close"
        start={
          <CameraRoundButton
            palette={palette}
            testID="receipt-scanner-gallery"
            icon={(color) => <ImageIcon size={22} color={color} />}
            label="Galerie"
            accessibilityLabel="Choisir une photo dans la galerie"
            onPress={handlePickFromGallery}
          />
        }
        shutter={<ShutterButton palette={palette} testID="receipt-scanner-capture" onPress={handleCapture} disabled={capturing} />}
        end={
          <CameraRoundButton
            palette={palette}
            testID="receipt-scanner-pdf"
            icon={(color) => <FileTextIcon size={22} color={color} />}
            label="PDF"
            accessibilityLabel="Importer un ticket au format PDF"
            onPress={handlePickPdf}
          />
        }
      />
    </YStack>
  )
}
