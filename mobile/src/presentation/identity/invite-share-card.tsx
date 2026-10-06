import { useTranslation } from '../../i18n/index.js'
/*
 * The owner's half of the join flow.
 *
 * The eight characters were already here, and they were already the entire
 * onboarding path for a second member — but the only way to move them was to
 * read them aloud or retype them into a message. Three ways out now, in the
 * order people actually reach for them: send it, copy it, or hold up the
 * screen and let the other phone read it.
 *
 * The share message deliberately carries the code *and* the link. There is no
 * universal link and cannot be one — the instance is self-hosted, so no domain
 * belongs to this app — which means the `gardemanger://` link only works on a
 * phone that already installed it. The person being invited is precisely the
 * person who has not, so the eight characters go in the message as text.
 */
import { useState } from 'react'
import { Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { CopyIcon, QrCodeIcon, RefreshIcon, ShareIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { getTelemetry } from '../../application/shared/telemetry.js'
import { AuthButton } from './auth-button.js'
import { buildJoinLink, buildShareMessage } from '../onboarding/join-link.js'

export function InviteShareCard({
  householdName,
  inviteCode,
  palette,
  regenerating,
  onRegenerate,
  onFeedback,
}: {
  householdName: string
  inviteCode: string
  palette: SoftPalette
  regenerating: boolean
  onRegenerate: () => void
  /** Copy and share are silent by nature; the hint is the only proof they ran. */
  onFeedback: (message: string) => void
}) {
  const { t } = useTranslation()
  const [showQr, setShowQr] = useState(false)

  async function handleShare() {
    try {
      await Share.share({ message: buildShareMessage(householdName, inviteCode) })
    } catch (error) {
      getTelemetry().recordError('share sheet failed to open', {
        error,
        attributes: { 'app.operation': 'identity.share_invite' },
      })
      onFeedback(t('identity.sharing_couldn_t_be_opened'))
    }
  }

  async function handleCopy() {
    const ok = await Clipboard.setStringAsync(inviteCode).catch((error) => {
      getTelemetry().recordError('clipboard write failed', {
        error,
        attributes: { 'app.operation': 'identity.copy_invite' },
      })
      return false
    })
    onFeedback(ok ? t('identity.code_copied') : t('identity.couldn_t_copy_the_code'))
  }

  return (
    <YStack
      marginTop="$4"
      backgroundColor={palette.cream}
      padding="$4"
      gap="$3"
      style={{
        borderTopLeftRadius: 26,
        borderTopRightRadius: 14,
        borderBottomRightRadius: 26,
        borderBottomLeftRadius: 14,
      }}
    >
      <Text fontSize={12} fontWeight="700" color={palette.creamText}>{t('identity.invite_code')}</Text>
      {/* Spaced by a third of an em rather than run together: eight characters
          read aloud over a kitchen table are read in pairs, and the tracking
          is what makes O/0 and I/1 separable at arm's length. */}
      <Text
        testID="household-invite-code"
        fontSize={26}
        fontWeight="800"
        color={palette.ink}
        letterSpacing={4}
        accessibilityLabel={t('identity.invite_code_2', { value1: inviteCode.split('').join(' ') })}
      >
        {inviteCode}
      </Text>
      <Text fontSize={12} fontWeight="500" color={palette.creamText}>{t('identity.give_it_to_someone_in_your_household_they_enter_it')}</Text>

      {/* Same "one line, not a wrap" fix as the Home Assistant modal's
          Enregistrer/Délier row (2026-09-09) — `dense` (`Chip`'s own
          compact recipe) buys back the width three labeled pills need to
          hold one row instead of wrapping to two. `gap="$3"`, not `$2`:
          `dense` pads its own facing hitSlop back to 6px a side (12px
          combined), and a facing gap under that overlaps two pills' press
          areas — the same threshold `Chip` rows are held to.
          `flexWrap="wrap"`, not `nowrap`: three labeled pills fit one line
          at the default text size, but RN scales that text with the
          system font setting, and the row has no horizontal scroll to
          fall back on — wrap is what keeps a large-type reading intact
          instead of clipping "Afficher le QR" (2026-09-10 audit). */}
      <XStack gap="$3" rowGap="$2" flexWrap="wrap">
        <PillButton
          testID="household-invite-share"
          label={t('identity.share')}
          size="dense"
          icon={(color) => <ShareIcon size={13} color={color} />}
          onPress={handleShare}
          accessibilityLabel={t('identity.share_invite_code')}
          palette={palette}
        />
        <PillButton
          testID="household-invite-copy"
          label={t('identity.copy')}
          tone="quiet"
          size="dense"
          icon={(color) => <CopyIcon size={13} color={color} />}
          onPress={handleCopy}
          accessibilityLabel={t('identity.copy_invite_code')}
          palette={palette}
        />
        <PillButton
          testID="household-invite-qr-toggle"
          label={showQr ? t('identity.hide_qr') : t('identity.show_qr')}
          tone="quiet"
          size="dense"
          icon={(color) => <QrCodeIcon size={13} color={color} />}
          onPress={() => setShowQr(!showQr)}
          palette={palette}
        />
      </XStack>

      {showQr ? (
        <YStack testID="household-invite-qr" alignItems="center" gap="$2" marginTop="$1">
          {/* On a white plate rather than the cream card: a QR needs its quiet
              zone and its full contrast ratio to decode, and `cream` is warm
              enough to cost both. */}
          <YStack backgroundColor="#FFFFFF" padding="$3" borderRadius={18}>
            <QRCode value={buildJoinLink(inviteCode)} size={168} backgroundColor="#FFFFFF" color="#16211A" />
          </YStack>
          <Text fontSize={12} fontWeight="500" color={palette.creamText}>{t('identity.scan_it_from_the_other_phone_s_welcome_screen')}</Text>
        </YStack>
      ) : null}

      <AuthButton
        testID="household-regenerate"
        label={t('identity.generate_a_new_code')}
        pendingLabel={t('identity.generating')}
        pending={regenerating}
        variant="secondary"
        icon={<RefreshIcon size={16} color={palette.ink} />}
        onPress={onRegenerate}
      />
    </YStack>
  )
}
