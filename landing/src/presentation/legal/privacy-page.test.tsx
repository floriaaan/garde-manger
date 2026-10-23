import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test } from 'vitest'
import { landingContentQueryOptions } from '../../application/content/landing-content.query.js'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeLandingConnector } from '../../infrastructure/fake/fake-landing-connector.js'
import { legalHead } from '../../lib/seo.js'
import { PrivacyPage } from './privacy-page.js'
import { EnglishPrivacyPage } from './privacy-page.en.js'

afterEach(cleanup)

test.each(['fr', 'en'] as const)('privacy policy renders in %s with working language and footer links', async (locale) => {
  const connector = new FakeLandingConnector()
  const queryClient = new QueryClient()
  await queryClient.ensureQueryData(landingContentQueryOptions(connector, locale))
  render(
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>
        {locale === 'en' ? <EnglishPrivacyPage /> : <PrivacyPage />}
      </ConnectorProvider>
    </QueryClientProvider>,
  )

  expect(screen.getByRole('heading', { level: 1, name: locale === 'en' ? 'Privacy Policy' : 'Politique de confidentialité' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'FR' }).getAttribute('href')).toBe('/privacy')
  expect(screen.getByRole('link', { name: 'EN' }).getAttribute('href')).toBe('/en/privacy')
  expect(screen.getByRole('link', { name: locale.toUpperCase() }).getAttribute('aria-current')).toBe('page')
  const contents = screen.getByRole('navigation', { name: locale === 'en' ? 'Contents' : 'Sommaire' })
  const links = within(contents).getAllByRole('link')
  expect(links).toHaveLength(11)
  for (const link of links) {
    expect(document.querySelector(link.getAttribute('href')!)).toBeTruthy()
  }
  expect(screen.getByText(locale === 'en'
    ? 'This policy must not be considered applicable to a self-hosted instance by default.'
    : 'La présente politique ne doit pas être considérée comme applicable par défaut à une instance auto-hébergée.')).toBeTruthy()
  const footer = within(screen.getByRole('contentinfo'))
  const path = locale === 'en' ? '/en/privacy' : '/privacy'
  expect(footer.getByRole('link', { name: locale === 'en' ? 'Privacy Policy' : 'Confidentialité' }).getAttribute('href')).toBe(path)
  expect(footer.getByRole('link', { name: 'Cookies' }).getAttribute('href')).toBe(`${path}#cookies`)
})

test.each(['/privacy', '/en/privacy'])('%s declares its canonical and language alternatives', (path) => {
  const { links } = legalHead(path, 'Privacy', 'Description')
  expect(links).toContainEqual({ rel: 'canonical', href: `https://gardemanger.floriaaan.fr${path}` })
  expect(links).toContainEqual({ rel: 'alternate', hrefLang: 'fr', href: 'https://gardemanger.floriaaan.fr/privacy' })
  expect(links).toContainEqual({ rel: 'alternate', hrefLang: 'en', href: 'https://gardemanger.floriaaan.fr/en/privacy' })
})
