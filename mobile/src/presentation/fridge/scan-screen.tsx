/*
 * The destination of iOS's floating "search"-role tab (see
 * `(tabs)/_layout.tsx`), and a real screen rather than a trick.
 *
 * It used to render `null` and run whichever tab had registered an `onScan`
 * handler through a ref-backed context, then bounce back. From a pushed
 * screen nothing was registered, so tapping Scanner teleported the user to
 * the home screen; from Accueil it opened a sheet over a blank white tab
 * and dismissing it left the user staring at that blank tab with "Scanner"
 * selected. Four commits tried to patch that indirection. A tab that owns
 * a screen needs none of it: the two choices are the screen.
 */
import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { CloseButton } from '../shared/close-button.js'
import { router } from 'expo-router'
import { goToProductScan, goToReceiptScan } from '../shared/scan-sheet.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ArrowRightIcon, CameraIcon, ReceiptIcon, ScanLineIcon } from '../dashboard/dashboard-icons.js'

function goToFridgeScan() {
  router.navigate('/fridge-scan/scan')
}

/** `onClose` when presented as a sheet (`app/scanner.tsx`); the iPhone tab has none. */
export function ScanScreen({ onClose }: { onClose?: () => void } = {}) {
  const palette = useSoftPalette()

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ScanLineIcon size={19} color={color} />}
          title="Scanner"
          subtitle="Remplis le garde-manger sans rien taper."
          trailing={onClose ? <CloseButton testID="scan-screen-close" palette={palette} onPress={onClose} /> : null}
        />
      }
    >
      {/* The whole-fridge photo leads: it is the one path that fills many
          shelves at once. The two single-purpose paths share a row under it
          instead of three identical bars competing for first place. */}
      <YStack gap="$3" marginTop="$4">
        <ScanChoice
          testID="scan-screen-fridge"
          title="Mon frigo"
          subtitle="Photographie chaque étagère, l’IA liste tout ce qu’elle voit."
          detail="1 à 5 photos"
          icon={(color) => <CameraIcon size={26} color={color} />}
          tint={palette.navCardWarm}
          corner="a"
          featured
          onPress={goToFridgeScan}
          palette={palette}
        />
        <XStack gap="$3" alignItems="stretch">
          <ScanChoice
            testID="scan-screen-product"
            title="Un produit"
            subtitle="Le code-barres remplit le nom et la catégorie."
            icon={(color) => <ScanLineIcon size={22} color={color} />}
            tint={palette.navCardTeal}
            corner="b"
            onPress={goToProductScan}
            palette={palette}
          />
          <ScanChoice
            testID="scan-screen-receipt"
            title="Un ticket"
            subtitle="Tous les produits du ticket de caisse d’un coup."
            icon={(color) => <ReceiptIcon size={22} color={color} />}
            tint={palette.navCardViolet}
            corner="c"
            onPress={goToReceiptScan}
            palette={palette}
          />
        </XStack>
      </YStack>
    </AppShell>
  )
}

const CORNERS = {
  a: { borderTopLeftRadius: 32, borderTopRightRadius: 18, borderBottomRightRadius: 32, borderBottomLeftRadius: 18 },
  b: { borderTopLeftRadius: 18, borderTopRightRadius: 28, borderBottomRightRadius: 16, borderBottomLeftRadius: 28 },
  c: { borderTopLeftRadius: 28, borderTopRightRadius: 16, borderBottomRightRadius: 28, borderBottomLeftRadius: 18 },
} as const

function ScanChoice({
  testID,
  title,
  subtitle,
  detail,
  icon,
  tint,
  corner,
  featured = false,
  onPress,
  palette,
}: {
  testID: string
  title: string
  subtitle: string
  detail?: string
  icon: (color: string) => React.ReactNode
  tint: string
  corner: keyof typeof CORNERS
  featured?: boolean
  onPress: () => void
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  const stretch = featured ? null : { flex: 1, alignSelf: 'stretch' as const }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${subtitle}`}
      style={[pointerCursor, stretch]}
    >
      <Animated.View style={[{ transform: [{ scale: hover.scale }] }, stretch]}>
        <YStack
          flex={featured ? undefined : 1}
          gap={featured ? '$5' : '$3'}
          padding={featured ? '$5' : '$4'}
          backgroundColor={tint}
          overflow="hidden"
          style={{
            ...CORNERS[corner],
            shadowColor: palette.shadowCool,
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.22,
            shadowRadius: 28,
            elevation: 6,
          }}
        >
          <XStack alignItems="center" justifyContent="space-between">
            <YStack
              width={featured ? 56 : 44}
              height={featured ? 56 : 44}
              borderRadius={featured ? 18 : 14}
              backgroundColor="rgba(255,255,255,0.18)"
              alignItems="center"
              justifyContent="center"
            >
              {icon(palette.onDark)}
            </YStack>
            {featured ? <ArrowRightIcon size={22} color={palette.onDark} /> : null}
          </XStack>
          <YStack gap="$1.5">
            <Text fontSize={featured ? 22 : 16} fontWeight="800" color={palette.onDark}>
              {title}
            </Text>
            <Text fontSize={featured ? 14 : 12} fontWeight="500" color={palette.onDarkSecondary}>
              {subtitle}
            </Text>
          </YStack>
          {detail ? (
            <YStack alignSelf="flex-start" backgroundColor={palette.heroPillFill} borderRadius={999} paddingHorizontal="$3" paddingVertical="$1">
              <Text fontSize={12} fontWeight="700" color={palette.onDark}>
                {detail}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </Animated.View>
    </Pressable>
  )
}
