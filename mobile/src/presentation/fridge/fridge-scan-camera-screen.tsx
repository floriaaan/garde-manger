import { t, useTranslation } from '../../i18n/index.js'
/**
 * Up to 5 photos of the fridge, one at a time, reviewed together on the next
 * screen. Mirrors `receipt-scanner-screen.tsx`'s camera/gallery pattern —
 * the difference is this one collects a batch before moving on, since a
 * fridge rarely fits in a single frame the way a receipt does.
 */
import { useRef, useState } from 'react'
import { Image, Pressable } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { CameraPermissionModal } from '../shared/camera-permission-modal.js'
import { CameraChrome, CameraRoundButton, ShutterButton } from '../shared/camera-chrome.js'
import { PillButton } from '../shared/pill-button.js'
import { goBack } from '../shared/navigation.js'
import { ImageIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const MAX_PHOTOS = 5

function hintFor(count: number) {
  if (count === 0) return t('fridge.one_photo_per_shelf_including_the_door')
  if (count >= MAX_PHOTOS) return t('fridge.photos_is_the_limit_start_the_analysis', { value1: MAX_PHOTOS })
  return t('fridge.continue_or_start_the_analysis', { value1: count, value2: MAX_PHOTOS })
}

export function FridgeScanCameraScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [capturing, setCapturing] = useState(false)
  const full = photos.length >= MAX_PHOTOS

  function goToReview() {
    router.replace({ pathname: '/fridge-scan/review', params: { imageUris: JSON.stringify(photos) } })
  }

  async function handleCapture() {
    if (!cameraRef.current || full || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 })
      if (photo?.uri) setPhotos((current) => [...current, photo.uri].slice(0, MAX_PHOTOS))
    } finally {
      setCapturing(false)
    }
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    })
    if (!result.canceled) {
      setPhotos((current) => [...current, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS))
    }
  }

  function removePhoto(uri: string) {
    setPhotos((current) => current.filter((p) => p !== uri))
  }

  if (!permission?.granted) {
    return (
      <CameraPermissionModal
        palette={palette}
        message={t('fridge.camera_access_is_required_to_photograph_your_fridge')}
        canAskAgain={permission?.canAskAgain ?? true}
        onRequestPermission={requestPermission}
        onClose={() => goBack('/(tabs)/scan')}
        requestTestID="fridge-scan-camera-request-permission"
        closeTestID="fridge-scan-camera-permission-close"
      >
        <Pressable
          testID="fridge-scan-camera-gallery-fallback"
          onPress={handlePickFromGallery}
          accessibilityRole="button"
          accessibilityLabel={t('fridge.choose_photos_from_the_gallery')}
          style={pointerCursor}
        >
          <Text fontSize={13} fontWeight="700" color={palette.mintPaleText} textAlign="center">{t('fridge.choose_photos_from_the_gallery')}</Text>
        </Pressable>
      </CameraPermissionModal>
    )
  }

  return (
    <YStack flex={1}>
      <CameraView testID="fridge-scan-camera" ref={cameraRef} style={{ flex: 1 }} />
      <CameraChrome
        palette={palette}
        guide="fridge"
        hint={hintFor(photos.length)}
        onClose={() => goBack('/(tabs)/scan')}
        closeTestID="fridge-scan-camera-close"
        tray={
          photos.length > 0 ? (
            <XStack gap="$3" justifyContent="center" paddingHorizontal="$4">
              {photos.map((uri, index) => (
                <Pressable
                  key={uri}
                  onPress={() => removePhoto(uri)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={t('fridge.remove_photo', { value1: index + 1 })}
                  style={pointerCursor}
                >
                  <YStack>
                    <Image source={{ uri }} style={{ width: 52, height: 52, borderRadius: 12, borderWidth: 2, borderColor: palette.onDark }} />
                    <YStack
                      position="absolute"
                      top={-6}
                      right={-6}
                      width={20}
                      height={20}
                      borderRadius={999}
                      backgroundColor={palette.cameraScrim}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <XIcon size={11} color={palette.onDark} />
                    </YStack>
                  </YStack>
                </Pressable>
              ))}
            </XStack>
          ) : null
        }
        start={
          full ? null : (
            <CameraRoundButton
              palette={palette}
              testID="fridge-scan-camera-gallery"
              icon={(color) => <ImageIcon size={22} color={color} />}
              label={t('fridge.gallery')}
              accessibilityLabel={t('fridge.choose_photos_from_the_gallery')}
              onPress={handlePickFromGallery}
            />
          )
        }
        shutter={<ShutterButton palette={palette} testID="fridge-scan-camera-capture" onPress={handleCapture} disabled={full || capturing} />}
        end={
          photos.length > 0 ? (
            // No glyph: the end slot is ~137pt on a 390pt phone, and "Analyser (5)" needs all of it.
            <PillButton
              testID="fridge-scan-camera-analyze"
              palette={palette}
              label={t('fridge.analyse', { value1: photos.length })}
              accessibilityLabel={t('fridge.analyse_photo', { count: photos.length })}
              onPress={goToReview}
            />
          ) : null
        }
      />
    </YStack>
  )
}
