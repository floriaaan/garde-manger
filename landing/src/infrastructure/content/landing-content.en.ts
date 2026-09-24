import type { LandingContent } from '../../domain/content/landing-content.js'

// ponytail: content is bundled with the site; move it behind the connector's
// HTTP side once a CMS or a backend endpoint serves it.
export const landingContentEn: LandingContent = {
  locale: 'en',
  repositoryUrl: 'https://github.com/floriaaan/garde-manger',
  hero: {
    eyebrow: 'Open source · official app soon, or at home',
    titleBefore: 'From the fridge to the plate, ',
    titleHighlight: 'nothing wasted',
    titleAfter: '.',
    subtitle:
      'Garde-manger tracks the whole household’s fridge, warns before dates pass, and suggests what to cook with what’s left. The official app is coming soon; you can already self-host it on your own server.',
    screenshots: [
      {
        src: '/screenshots/accueil.jpg',
        alt: 'Garde-manger home screen: 5 products to cook first, this week’s counters and the list of items to use soonest.',
      },
      {
        src: '/screenshots/recettes.jpg',
        alt: 'Recipes screen: a chicken-and-spinach skillet suggested for tonight, with 2 of 3 ingredients already at home.',
      },
    ],
  },
  features: [
    {
      id: 'receipt',
      title: 'The receipt or the fridge, in one photo',
      description:
        'Snap a receipt or the inside of your fridge: every item joins the pantry with its quantity. One AI read, no separate OCR step.',
      illustration: 'receipt',
    },
    {
      id: 'expiry',
      title: 'Dates, without the mental load',
      description:
        'Fresh, first-to-go, expired: every product says where it stands, and the home screen shows what needs using this week.',
      illustration: 'carrot',
    },
    {
      id: 'recipes',
      title: 'Recipes with what’s left',
      description:
        'The AI starts from the products closest to their date. Once cooked, the recipe removes what it used.',
      illustration: 'pot-of-food',
    },
    {
      id: 'shopping-list',
      title: 'One shared shopping list',
      description:
        'The whole household adds, ticks and sees the same list, syncable with Home Assistant.',
      illustration: 'shopping-cart',
    },
  ],
  offers: {
    titleHighlight: 'Two ways',
    titleAfter: ' to get started',
    subtitle:
      'Same app, same features. The official app will be the easiest way to start; you can also install everything at home.',
    hosted: {
      label: 'Hosted',
      tag: 'The easy way',
      title: 'You install the app, we handle the rest.',
      description: 'No server, no updates, no backups to manage. Your household is ready as soon as you sign up.',
      perks: ['Hosted and backed up for you', 'Automatic updates', 'Your own account, one shared household'],
      tiers: [
        {
          name: 'Free',
          description: 'Inventory, expiry dates, shared shopping list, and 5 AI uses a month to try it out.',
        },
        {
          name: 'Garde-manger plan',
          description: 'Receipt and fridge scanning, recipes with what’s left. One subscription for the whole household.',
          price: '€0.99/month',
        },
      ],
      cta: { label: 'Opening soon', href: null },
    },
    selfHosted: {
      label: 'Self-hosted',
      tag: 'Local-first',
      title: 'Your server, your database.',
      description:
        'For anyone who wants full control: the API runs on your own machine, the app only ever talks to your server.',
      perks: [
        'Your server, your database',
        'Local AI with Ollama, or your Gemini / OpenAI key',
        'Open source, MIT licence',
      ],
      commands: [
        'nano .env   # secrets + your server’s IP',
        'docker compose up -d',
        'curl http://localhost:3333/health',
      ],
      note: 'The app isn’t on the stores yet: on Android, install it from the APK in Releases. With Ollama, nothing leaves your home.',
      cta: { label: 'Read the guide', href: 'https://github.com/floriaaan/garde-manger#installation' },
    },
  },
  faq: [
    {
      question: 'Is it really free?',
      answer:
        'Yes, if you host your own instance: the code is MIT-licensed and everything is included, AI too (your own Gemini or OpenAI key, or a local model). Otherwise, the official instance has a free tier that lets you use the app, with AI usage quotas.',
    },
    {
      question: 'What if I don’t want to run a server?',
      answer:
        'The official hosted instance is open: free for the essentials with 5 AI uses a month, and a €0.99/month Garde-manger plan for the whole household (receipt and fridge scanning, recipes).',
    },
    {
      question: 'Does my data go anywhere else?',
      answer:
        'The official instance is hosted in Europe and GDPR-compliant. Self-hosted instances are privacy by design: the app only talks to your server, and with a local Ollama model nothing leaves your home. With a Gemini or OpenAI key, receipt photos are sent to that provider to be read.',
    },
    {
      question: 'Can several people use it?',
      answer:
        'That’s the whole idea: one household, several members, one shared pantry. Join a household with its invite code.',
    },
    {
      question: 'How do I sign in?',
      answer:
        'With email and password, or with an existing account (social sign-in). On your own instance, password login can be turned off to allow only that.',
    },
    {
      question: 'What devices does it run on?',
      answer:
        'iOS and Android. The app is coming to the stores. In the meantime, on Android it installs from the APK published in Releases; on iOS it temporarily runs through Expo Go.',
    },
  ],
  stores: { appStore: null, playStore: null },
  ui: {
    skipToContent: 'Skip to content',
    nav: { features: 'Features', start: 'Get started', faq: 'FAQ' },
    cta: { start: 'Get started', viewOnGithub: 'View on GitHub' },
    featuresHeading: 'Features',
    starsSuffix: 'stars on GitHub',
    waitlist: {
      label: 'Your email',
      submit: 'Notify me',
      sending: 'Sending…',
      success: 'Got it! We’ll let you know when the apps are out.',
      error: 'Something went wrong — try again in a moment.',
    },
    stats: {
      heading: 'Already in kitchens',
      subtitle: 'Live numbers from the hosted instance and the repository.',
      households: 'Households',
      productsConsumed: 'Products consumed',
      recipesGenerated: 'AI-suggested recipes',
      starsOnGithub: 'stars on GitHub',
      version: 'Version',
      license: 'License',
    },
    offers: {
      or: 'or',
      storesAvailable: 'App Store and Google Play',
      storesFallback: 'iOS and Android · coming soon to the stores',
    },
    faq: {
      headingBefore: 'Got',
      headingHighlight: 'questions',
      headingAfter: ' ?',
      subtitle: 'Hosting, AI, data: what people ask before getting started.',
      askYours: 'Ask yours',
    },
    footer: {
      taglineBefore: 'Nothing gets lost ',
      taglineHighlight: 'in the back of the fridge',
      taglineAfter: ' again.',
      navLabel: 'Footer',
      navApp: 'The app',
      navProject: 'The project',
      navLegal: 'Legal',
      links: {
        features: 'Features',
        start: 'Two ways to get started',
        faq: 'Frequently asked questions',
        github: 'GitHub',
        selfHost: 'Self-hosting',
        license: 'MIT License',
        issues: 'Report an issue',
      },
      credit: 'Garde-manger · open source, MIT licensed',
      illustrationCredit: 'Illustrations: Fluent Emoji © Microsoft, MIT licensed.',
    },
  },
}
