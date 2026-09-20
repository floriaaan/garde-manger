import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { legalHead } from '../lib/seo.js'
import { TermsPage } from '../presentation/legal/terms-page.js'

export const Route = createFileRoute('/cgu')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'fr')),
  head: () =>
    legalHead(
      '/cgu',
      'Conditions générales d’utilisation',
      'Conditions d’utilisation du service Garde-manger officiel. Elles ne s’appliquent pas au logiciel auto-hébergé.',
    ),
  component: TermsPage,
})
