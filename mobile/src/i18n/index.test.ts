import { createInstance } from 'i18next'
import { getLocales } from 'expo-localization'
import { AppState, type AppStateStatus } from 'react-native'
import { i18n, resolveLanguage, setLocaleOverride, t, watchSystemLanguage, weekdayLabel } from './index.js'
import fr from './locales/fr.json'
import en from './locales/en.json'

function deviceLanguage(languageTag: string) {
  jest.mocked(getLocales).mockReturnValue([{ ...getLocales()[0], languageTag }])
}

afterEach(() => {
  deviceLanguage('fr-FR')
  setLocaleOverride(null)
  jest.restoreAllMocks()
})

test.each([
  [['en-US'], 'en'],
  [['en-GB'], 'en'],
  [['fr-CA'], 'fr'],
  [['EN_us'], 'en'],
  [['de-DE', 'en-GB'], 'en'],
  [['es-ES'], 'fr'],
  [[], 'fr'],
] as const)('resolves preferred locales %j to %s', (locales, expected) => {
  expect(resolveLanguage(locales)).toBe(expected)
})

test('initializes synchronously and detects the device language before rendering', () => {
  deviceLanguage('en-US')
  jest.isolateModules(() => {
    const startup = require('./index.js') as typeof import('./index.js')
    expect(startup.i18n.isInitialized).toBe(true)
    expect(startup.i18n.language).toBe('en')
    expect(startup.t('shared.home')).toBe('Home')
  })
})

test('uses French when an English translation is missing', async () => {
  const instance = createInstance()
  await instance.init({
    ...i18n.options,
    lng: 'en',
    resources: {
      fr: { translation: { ...fr, fallbackOnly: 'Texte de secours' } },
      en: { translation: en },
    },
  })
  expect(instance.t('fallbackOnly')).toBe('Texte de secours')
})

test('uses the correct French and English plurals, including zero', () => {
  setLocaleOverride('fr')
  expect(t('common.products_count', { count: 0 })).toBe('0 produit')
  expect(t('common.products_count', { count: 2 })).toBe('2 produits')
  setLocaleOverride('en')
  expect(t('common.products_count', { count: 0 })).toBe('0 products')
  expect(t('common.products_count', { count: 1 })).toBe('1 product')
  expect(t('common.products_count', { count: 2 })).toBe('2 products')
})

test('keeps a debug override on foreground and restores system detection on reset', () => {
  let foreground: ((state: AppStateStatus) => void) | undefined
  const remove = jest.fn()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    foreground = listener
    return { remove }
  })
  const stop = watchSystemLanguage()
  setLocaleOverride('en')
  foreground?.('active')
  expect(i18n.language).toBe('en')
  expect(weekdayLabel(1)).toBe('Monday')
  setLocaleOverride(null)
  expect(i18n.language).toBe('fr')
  deviceLanguage('en-GB')
  foreground?.('background')
  expect(i18n.language).toBe('fr')
  foreground?.('active')
  expect(i18n.language).toBe('en')
  stop()
  expect(remove).toHaveBeenCalledTimes(1)
})

test('every French message has an English translation and matching interpolation values', () => {
  const placeholders = (value: string) => [...value.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort()
  for (const [section, messages] of Object.entries(fr)) {
    for (const [key, value] of Object.entries(messages)) {
      if (key.endsWith('_many')) continue // French has an additional CLDR plural form.
      const translated = (en as Record<string, Record<string, string>>)[section]?.[key]
      expect(translated).toBeDefined()
      // A translation can omit a redundant suffix; it cannot invent an unset value.
      for (const variable of placeholders(translated)) expect(placeholders(value)).toContain(variable)
    }
  }
})
