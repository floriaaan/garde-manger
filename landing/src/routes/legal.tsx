import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { legalHead } from '../lib/seo.js'
import { LegalNoticePage } from '../presentation/legal/legal-notice-page.js'

export const Route = createFileRoute('/legal')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'fr')),
  head: () =>
    legalHead(
      '/legal',
      'Mentions légales',
      'Éditeur, hébergeur et coordonnées de l’instance officielle Garde-manger.',
    ),
  component: LegalNoticePage,
})
