/**
 * The way into the receipt history, on the dashboard.
 *
 * It used to be a row inside Réglages, under a section called "Données" —
 * the foyer's own shopping history filed in the screen you open to change how
 * the app behaves. Réglages is where you configure; a list of what you bought
 * is content. And the row promised nothing: a label and a chevron, no count,
 * no last store, so there was no reason to tap it and find out.
 *
 * A full-width row rather than a third `NavCard`: the two saturated tiles
 * above it are the four-tab sections, and adding a third would both break
 * their pair and claim receipts are a fifth section. This is a doorway under
 * them, not a peer.
 */
import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ChevronRightIcon, ReceiptIcon } from './dashboard-icons.js'
import type { SoftPalette } from './soft-palette.js'
import type { Receipt } from '../../domain/receipt/receipt.js'

/**
 * "1 ticket · dernier : Carrefour" — the count answers "is there anything in
 * there", the store answers "is it the one I'm thinking of". An empty history
 * says what would fill it instead of counting to zero.
 */
export function receiptsSummary(receipts: readonly Receipt[]): string {
  if (receipts.length === 0) return 'Scanne un ticket pour remplir ton garde-manger'
  const latest = receipts.reduce((newest, receipt) => (receipt.scannedAt > newest.scannedAt ? receipt : newest))
  return `${receipts.length} ticket${receipts.length > 1 ? 's' : ''} · dernier : ${latest.storeName}`
}

export function ReceiptsRow({
  receipts,
  pending,
  onPress,
  palette,
}: {
  receipts: readonly Receipt[]
  pending: boolean
  onPress: () => void
  palette: SoftPalette
}) {
  const hover = useHoverPress()

  return (
    <Pressable
      testID="dashboard-receipts"
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      // The summary is the only reason to tap the row; the title alone
      // announces a category and swallows the fact.
      accessibilityLabel={pending ? 'Tickets de caisse. Chargement' : `Tickets de caisse. ${receiptsSummary(receipts)}`}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          gap="$3"
          // `cream`, not `gradientBottom`: the ground *is* `gradientBottom`, so
          // in dark mode this row was a #120D08 card on a #120D08 page, held up
          // only by a shadow that is a faint warm glow over there. Cream is the
          // app's raised neutral in both themes — warm off-white on the light
          // ground, a clear step above the near-black one.
          backgroundColor={palette.cream}
          borderRadius={18}
          padding="$3"
          minHeight={44}
          style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 1 }}
        >
          {/* Violet, the colour the receipt already wears in the scan sheet —
              the concept keeps its chip across the app even where a neighbour
              card happens to be violet too. */}
          <YStack width={36} height={36} borderRadius={12} backgroundColor={palette.chipViolet} alignItems="center" justifyContent="center">
            <ReceiptIcon size={18} color={palette.onDark} />
          </YStack>
          <YStack flex={1}>
            <Text fontSize={14} fontWeight="700" color={palette.ink}>
              Tickets de caisse
            </Text>
            <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} numberOfLines={1}>
              {pending ? 'Chargement…' : receiptsSummary(receipts)}
            </Text>
          </YStack>
          <ChevronRightIcon size={18} color={palette.inkSecondary} />
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
