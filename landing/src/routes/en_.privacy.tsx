import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { legalHead } from '../lib/seo.js'
import { EnglishPrivacyPage } from '../presentation/legal/privacy-page.en.js'

export const Route = createFileRoute('/en_/privacy')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'en')),
  head: () => legalHead(
    '/en/privacy',
    'Privacy Policy',
    'Personal data processed by the official Garde-manger instance, purposes, retention periods and your rights.',
  ),
  component: EnglishPrivacyPage,
})
