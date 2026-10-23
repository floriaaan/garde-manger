export const SITE_URL = 'https://gardemanger.floriaaan.fr'

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`
}

/** Head for the static legal pages: title, description, canonical and Open Graph. */
export function legalHead(path: string, title: string, description: string) {
  const fullTitle = `${title} — Garde-manger`
  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:url', content: absoluteUrl(path) },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
    ],
    links: [
      { rel: 'canonical', href: absoluteUrl(path) },
      ...(['/privacy', '/en/privacy'].includes(path) ? [
        { rel: 'alternate', hrefLang: 'fr', href: absoluteUrl('/privacy') },
        { rel: 'alternate', hrefLang: 'en', href: absoluteUrl('/en/privacy') },
        { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl('/privacy') },
      ] : []),
    ],
  }
}
