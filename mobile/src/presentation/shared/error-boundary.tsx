import { useTranslation } from '../../i18n/index.js'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Text, YStack } from './tamagui-typed.js'
import { PillButton } from './pill-button.js'
import { TriangleAlertIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { getTelemetry } from '../../application/shared/telemetry.js'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Class component, not a hook — React only supports catching render-time
 * errors via `getDerivedStateFromError`/`componentDidCatch`; no hook
 * equivalent exists. Mounted once at the app root (`_layout.tsx`): a crash
 * anywhere in the tree below it (an assumed-present `data.foo` that turned
 * out `undefined` because the server never answered, say) now renders the
 * fallback below instead of RN's fatal redbox taking over the whole app.
 *
 * Deliberately separate from `toast.tsx`: a toast assumes the screen under
 * it is still alive and just failed one operation. A component that threw
 * during render has already lost its whole tree — there's no screen left to
 * toast over, only a full-screen replacement to offer, with a way back in.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.error('[ErrorBoundary]', error, info.componentStack)
    getTelemetry().recordError('unhandled render error', {
      error,
      attributes: { 'error.message': error.message },
    })
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) return <ErrorFallback onRetry={this.reset} />
    return this.props.children
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$3"
      padding="$5"
      backgroundColor={palette.gradientBottom}
    >
      <TriangleAlertIcon size={40} color={palette.expiredText} />
      <Text fontSize={17} fontWeight="800" color={palette.ink} textAlign="center">{t('shared.oops_something_went_wrong')}</Text>
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">{t('shared.try_again_if_it_persists_check_your_connection')}</Text>
      <PillButton label={t('dashboard.try_again')} accessibilityLabel={t('dashboard.try_again')} onPress={onRetry} palette={palette} centered />
    </YStack>
  )
}
