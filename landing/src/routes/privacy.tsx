import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { legalHead } from '../lib/seo.js'
import { PrivacyPage } from '../presentation/legal/privacy-page.js'

export const Route = createFileRoute('/privacy')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'fr')),
  head: () =>
    legalHead(
      '/privacy',
      'Politique de confidentialité',
      'Données personnelles traitées par l’instance officielle Garde-manger, finalités, durées de conservation et droits des utilisateurs.',
    ),
  component: PrivacyPage,
})
