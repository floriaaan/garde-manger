import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { legalHead } from '../lib/seo.js'
import { SalesTermsPage } from '../presentation/legal/sales-terms-page.js'

export const Route = createFileRoute('/cgv')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'fr')),
  head: () =>
    legalHead(
      '/cgv',
      'Conditions générales de vente',
      'Offres, prix, abonnement, rétractation et médiation de l’instance officielle Garde-manger.',
    ),
  component: SalesTermsPage,
})
