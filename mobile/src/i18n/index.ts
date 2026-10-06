import { getLocales } from 'expo-localization'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { AppState } from 'react-native'
import fr from './locales/fr.json'
import en from './locales/en.json'

export { useTranslation } from 'react-i18next'

export function resolveLanguage(languageTags: readonly string[]): 'fr' | 'en' {
  for (const tag of languageTags) {
    const language = tag.toLowerCase().split(/[-_]/)[0]
    if (language === 'fr' || language === 'en') return language
  }
  return 'fr'
}

function systemLanguage() {
  return resolveLanguage(getLocales().map((locale) => locale.languageTag))
}

// Bundled resources and synchronous init keep the very first frame translated.
export const i18n = createInstance()
void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: systemLanguage(),
  supportedLngs: ['fr', 'en'],
  fallbackLng: 'fr',
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

// Non-component helpers read the current language at call time.
export const t = i18n.t.bind(i18n)
export const getLocale = () => i18n.resolvedLanguage ?? 'fr'

export type LocaleOverride = 'fr' | 'en' | null
let localeOverride: LocaleOverride = null
export const getLocaleOverride = () => localeOverride

/** Debug-only override for this session; null returns to the device language. */
export function setLocaleOverride(language: LocaleOverride) {
  localeOverride = language
  syncSystemLanguage()
}

export function syncSystemLanguage() {
  const language = localeOverride ?? systemLanguage()
  if (language !== i18n.language) void i18n.changeLanguage(language)
}

export function weekdayLabel(day: number) {
  // 4 January 2026 is a Sunday. API day indices remain Sunday=0.
  return new Intl.DateTimeFormat(getLocale(), { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, 0, 4 + day)))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR' }).format(amount)
}

/** Android can change app/system language while the app is in the background. */
export function watchSystemLanguage() {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') syncSystemLanguage()
  })
  return () => subscription.remove()
}
