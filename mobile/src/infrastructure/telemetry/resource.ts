import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { newSpanId } from './ids.js'

/**
 * The OTLP resource describing this app instance.
 *
 * Everything here is either a constant or a per-launch random id. No device
 * identifier, no advertising id, no locale, no carrier, no IP: none of them
 * has ever been needed to fix a bug that `os.name` and `service.version`
 * could not localise, and each one turns telemetry into personal data. The
 * backend drops any attribute not on its allowlist anyway (cf.
 * `otlp-sanitizer.ts`), so adding one here is a two-sided decision.
 *
 * `app.session.id` lives for one app launch and is never persisted, which is
 * what makes it a session identifier rather than a device identifier.
 */
export const SESSION_ID = newSpanId()

export interface OtlpAttribute {
  key: string
  value: { stringValue: string } | { intValue: number } | { boolValue: boolean }
}

export function stringAttribute(key: string, value: string): OtlpAttribute {
  return { key, value: { stringValue: value } }
}

export function intAttribute(key: string, value: number): OtlpAttribute {
  return { key, value: { intValue: value } }
}

export function buildResource(): { attributes: OtlpAttribute[] } {
  return {
    attributes: [
      stringAttribute('service.name', Platform.OS === 'web' ? 'garde-manger-web' : 'garde-manger-mobile'),
      stringAttribute('service.version', Constants.expoConfig?.version ?? '0.0.0'),
      stringAttribute('service.build', process.env.EXPO_PUBLIC_APP_BUILD
        ?? (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber
          : Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode?.toString() : undefined)
        ?? Constants.expoConfig?.version ?? '0.0.0'),
      stringAttribute(
        'deployment.environment.name',
        process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
      ),
      stringAttribute('os.name', Platform.OS),
      stringAttribute('os.version', String(Platform.Version)),
      stringAttribute('app.session.id', SESSION_ID),
      stringAttribute('telemetry.sdk.name', 'garde-manger-mobile-otlp'),
      stringAttribute('telemetry.sdk.language', 'webjs'),
    ],
  }
}
