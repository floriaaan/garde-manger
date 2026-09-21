export type Locale = 'fr' | 'en'

export type IllustrationName = 'receipt' | 'pot-of-food' | 'shopping-cart' | 'carrot' | 'chart-increasing'

export interface Feature {
  id: string
  title: string
  description: string
  illustration: IllustrationName
}

export interface Screenshot {
  src: string
  alt: string
}

export interface Offer {
  /** Short name of the way to use the app, e.g. "Clé en main". */
  label: string
  tag: string
  title: string
  description: string
  perks: string[]
  /** `href: null` while the offer isn't open — rendered as a disabled "bientôt" pill. */
  cta: { label: string; href: string | null }
}

export interface HostedOffer extends Offer {
  /** Free core first, then the AI subscription. `price` is unset for the free tier. */
  tiers: { name: string; description: string; price?: string }[]
}

export interface SelfHostedOffer extends Offer {
  commands: string[]
  /** Small print under the commands: Expo Go caveat, AI provider privacy. */
  note: string
}

export interface FaqEntry {
  question: string
  answer: string
}

export interface StoreLinks {
  /** `null` until the app is published — rendered as a disabled "bientôt" badge. */
  appStore: string | null
  playStore: string | null
}

/**
 * Chrome copy: navigation, buttons, section headings and other strings that
 * aren't editorial content but still need to change per locale.
 */
export interface LandingUi {
  skipToContent: string
  nav: { features: string; start: string; faq: string }
  cta: { start: string; viewOnGithub: string }
  /** sr-only heading above the feature cards. */
  featuresHeading: string
  /** sr-only suffix after the GitHub star count in the hero eyebrow. */
  starsSuffix: string
  waitlist: { label: string; submit: string; sending: string; success: string }
  stats: {
    heading: string
    subtitle: string
    households: string
    productsConsumed: string
    recipesGenerated: string
    starsOnGithub: string
    version: string
    license: string
  }
  offers: {
    or: string
    storesAvailable: string
    storesFallback: string
  }
  faq: {
    headingBefore: string
    headingHighlight: string
    headingAfter: string
    subtitle: string
    askYours: string
  }
  footer: {
    taglineBefore: string
    taglineHighlight: string
    taglineAfter: string
    navLabel: string
    navApp: string
    navProject: string
    navLegal: string
    links: {
      features: string
      start: string
      faq: string
      github: string
      selfHost: string
      license: string
      issues: string
    }
    credit: string
    illustrationCredit: string
  }
}

export interface LandingContent {
  locale: Locale
  repositoryUrl: string
  hero: {
    eyebrow: string
    /** The headline is split so the presentation can circle the middle part. */
    titleBefore: string
    titleHighlight: string
    titleAfter: string
    subtitle: string
    /** Front phone first, a second one peeks behind it. Empty = an honest placeholder. */
    screenshots: Screenshot[]
  }
  features: Feature[]
  /** The two ways to use the app — hosted first and larger. */
  offers: {
    /** Split like the hero headline so the presentation can underline the first part. */
    titleHighlight: string
    titleAfter: string
    subtitle: string
    hosted: HostedOffer
    selfHosted: SelfHostedOffer
  }
  faq: FaqEntry[]
  stores: StoreLinks
  ui: LandingUi
}
