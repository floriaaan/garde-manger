import { defaultConfig } from '@tamagui/config/v5'
import { createFont, createTamagui } from 'tamagui'

// Native keeps its existing font delivery; web faces are self-hosted in fonts.css.
const isWeb = process.env.TAMAGUI_TARGET === 'web'
export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    ...defaultConfig.fonts,
    body: createFont({
      ...defaultConfig.fonts.body,
      family: isWeb ? '"Plus Jakarta Sans", system-ui, sans-serif' : defaultConfig.fonts.body.family,
    }),
    heading: createFont({
      ...defaultConfig.fonts.heading,
      family: isWeb ? 'Spectral, Georgia, serif' : defaultConfig.fonts.heading.family,
      ...(isWeb ? { weight: { 0: '600', 6: '600', 9: '600' } } : {}),
    }),
  },
})
export default tamaguiConfig
export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
