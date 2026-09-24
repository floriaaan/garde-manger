import type { LandingContent } from '../../domain/content/landing-content.js'

// ponytail: content is bundled with the site; move it behind the connector's
// HTTP side once a CMS or a backend endpoint serves it.
export const landingContentFr: LandingContent = {
  locale: 'fr',
  repositoryUrl: 'https://github.com/floriaaan/garde-manger',
  hero: {
    eyebrow: 'Open source · app officielle bientôt, ou chez toi',
    titleBefore: 'Du frigo à l’assiette, ',
    titleHighlight: 'sans rien jeter',
    titleAfter: '.',
    subtitle:
      'Garde-manger tient l’inventaire du frigo de tout le foyer, prévient avant les dates et propose quoi cuisiner avec ce qui reste. L’app officielle arrive bientôt ; tu peux déjà l’auto-héberger sur ton propre serveur.',
    screenshots: [
      {
        src: '/screenshots/accueil.jpg',
        alt: 'Accueil de Garde-manger : 5 produits à cuisiner en premier, les compteurs de la semaine et la liste des produits à consommer en premier.',
      },
      {
        src: '/screenshots/recettes.jpg',
        alt: 'Écran Recettes : une poêlée poulet-épinards proposée pour ce soir avec 2 ingrédients sur 3 déjà chez toi.',
      },
    ],
  },
  features: [
    {
      id: 'receipt',
      title: 'Le ticket ou le frigo, en une photo',
      description:
        'Photographie un ticket de caisse ou l’intérieur du frigo : chaque article rejoint le garde-manger avec sa quantité. Une seule lecture par l’IA, pas d’OCR à part.',
      illustration: 'receipt',
    },
    {
      id: 'expiry',
      title: 'Les dates, sans y penser',
      description:
        'Frais, en premier, dépassé : chaque produit dit où il en est, et l’accueil montre ce qui doit partir cette semaine.',
      illustration: 'carrot',
    },
    {
      id: 'recipes',
      title: 'Des recettes avec ce qui reste',
      description:
        'L’IA part des produits qui approchent de leur date. Une fois cuisinée, la recette retire ce qu’elle a utilisé.',
      illustration: 'pot-of-food',
    },
    {
      id: 'shopping-list',
      title: 'Une liste de courses commune',
      description:
        'Tout le foyer ajoute, coche et voit la même liste, synchronisable avec Home Assistant.',
      illustration: 'shopping-cart',
    },
  ],
  offers: {
    titleHighlight: 'Deux façons',
    titleAfter: ' de s’y mettre',
    subtitle:
      'Même app, mêmes fonctionnalités. L’app officielle sera la façon la plus simple de démarrer ; tu peux aussi tout installer chez toi.',
    hosted: {
      label: 'Clé en main',
      tag: 'Le plus simple',
      title: 'Tu installes l’app, on s’occupe du reste.',
      description: 'Pas de serveur, pas de mises à jour, pas de sauvegardes à gérer. Ton foyer est prêt dès l’inscription.',
      perks: ['Hébergé et sauvegardé pour toi', 'Mises à jour automatiques', 'Chacun son compte, un foyer partagé'],
      tiers: [
        {
          name: 'Gratuit',
          description: 'Inventaire, dates de péremption, liste de courses partagée, et 5 utilisations de l’IA par mois pour essayer.',
        },
        {
          name: 'Abonnement Garde-manger',
          description: 'Scan de tickets et du frigo, recettes avec ce qui reste. Un seul abonnement pour tout le foyer.',
          price: '0,99€/mois',
        },
      ],
      cta: { label: 'Ouverture bientôt', href: null },
    },
    selfHosted: {
      label: 'Auto-hébergé',
      tag: 'Local-first',
      title: 'Ton serveur, ta base.',
      description:
        'Pour qui veut garder la main : l’API tourne sur ta machine, l’app ne parle qu’à ton serveur.',
      perks: [
        'Ton serveur, ta base de données',
        'IA locale avec Ollama, ou ta clé Gemini / OpenAI',
        'Open source, licence MIT',
      ],
      commands: [
        'nano .env   # secrets + IP du serveur',
        'docker compose up -d',
        'curl http://localhost:3333/health',
      ],
      note: 'L’app n’est pas encore sur les stores : sur Android, tu l’installes via l’APK des Releases. Avec Ollama, rien ne sort de chez toi.',
      cta: { label: 'Lire le guide', href: 'https://github.com/floriaaan/garde-manger#installation' },
    },
  },
  faq: [
    {
      question: 'C’est vraiment gratuit ?',
      answer:
        'Oui, si tu héberges ta propre instance : le code est sous licence MIT et tout est inclus, IA comprise (ta clé Gemini ou OpenAI, ou un modèle local via Ollama). Sinon, l’instance officielle propose une offre gratuite qui permet d’utiliser l’application, avec des quotas d’utilisation de l’IA.',
    },
    {
      question: 'Et si je ne veux pas gérer de serveur ?',
      answer:
        'L’instance officielle clé en main est ouverte : gratuite pour l’essentiel avec 5 utilisations de l’IA par mois, et un abonnement Garde-manger à 0,99€/mois pour tout le foyer (scan de tickets et du frigo, recettes).',
    },
    {
      question: 'Mes données partent-elles ailleurs ?',
      answer:
        'L’instance officielle est hébergée en Europe, dans le respect du RGPD. Les instances auto-hébergées sont privacy by design : l’app ne parle qu’à ton serveur, et avec un modèle local Ollama, rien ne sort de chez toi. Avec une clé Gemini ou OpenAI, les photos de tickets sont envoyées à ce fournisseur pour être lues.',
    },
    {
      question: 'On peut être plusieurs ?',
      answer:
        'C’est le principe : un foyer, plusieurs membres, un seul garde-manger partagé. On rejoint un foyer avec son code d’invitation.',
    },
    {
      question: 'Comment se connecte-t-on ?',
      answer:
        'Par email et mot de passe, ou avec un compte existant (connexion sociale). Sur ton instance, le mot de passe peut être désactivé pour n’autoriser que cette connexion.',
    },
    {
      question: 'Sur quels appareils ?',
      answer:
        'iOS et Android. L’app arrive sur les stores. En attendant, sur Android, elle s’installe avec l’APK publié dans les Releases ; sur iOS, elle passe provisoirement par Expo Go.',
    },
  ],
  stores: { appStore: null, playStore: null },
  ui: {
    skipToContent: 'Aller au contenu',
    nav: { features: 'Fonctionnalités', start: 'Démarrer', faq: 'FAQ' },
    cta: { start: 'Commencer', viewOnGithub: 'Voir sur GitHub' },
    featuresHeading: 'Fonctionnalités',
    starsSuffix: 'étoiles sur GitHub',
    waitlist: {
      label: 'Ton email',
      submit: 'Me prévenir',
      sending: 'Envoi…',
      success: 'C’est noté ! On te prévient à la sortie des apps.',
      error: 'Ça n’a pas marché — réessaie dans un instant.',
    },
    stats: {
      heading: 'Déjà dans les cuisines',
      subtitle: 'Les chiffres de l’instance hébergée et du dépôt, en direct.',
      households: 'Foyers',
      productsConsumed: 'Produits consommés',
      recipesGenerated: 'Recettes proposées par l’IA',
      starsOnGithub: 'étoiles sur GitHub',
      version: 'Version',
      license: 'Licence',
    },
    offers: {
      or: 'ou',
      storesAvailable: 'App Store et Google Play',
      storesFallback: 'iOS et Android · bientôt sur les stores',
    },
    faq: {
      headingBefore: 'Des',
      headingHighlight: 'questions',
      headingAfter: ' ?',
      subtitle: 'Hébergement, IA, données : ce qu’on nous demande avant de se lancer.',
      askYours: 'Poser la tienne',
    },
    footer: {
      taglineBefore: 'Plus rien ne se perd ',
      taglineHighlight: 'au fond du frigo',
      taglineAfter: '.',
      navLabel: 'Pied de page',
      navApp: 'L’app',
      navProject: 'Le projet',
      navLegal: 'Légal',
      links: {
        features: 'Fonctionnalités',
        start: 'Deux façons de s’y mettre',
        faq: 'Questions fréquentes',
        github: 'GitHub',
        selfHost: 'Auto-hébergement',
        license: 'Licence MIT',
        issues: 'Signaler un problème',
      },
      credit: 'Garde-manger · open source, licence MIT',
      illustrationCredit: 'Illustrations : Fluent Emoji © Microsoft, licence MIT.',
    },
  },
}
