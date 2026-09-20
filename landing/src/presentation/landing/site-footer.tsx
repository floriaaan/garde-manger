import { ArrowRightIcon } from 'lucide-react'
import type { LandingContent } from '../../domain/content/landing-content.js'
import { Button } from '../ui/button.js'
import { GithubIcon } from '../ui/github-icon.js'
import { illustrationSrc } from './illustration.js'
import { ScribbleUnderline } from './scribble-underline.js'

const LEGAL_LINKS = [
  { href: '/legal', label: 'Mentions légales' },
  { href: '/privacy', label: 'Confidentialité' },
  { href: '/cgu', label: 'CGU' },
  { href: '/cgv', label: 'CGV' },
  { href: '/privacy#cookies', label: 'Cookies' },
  { href: '/cgv#mediation', label: 'Médiation / Litiges' },
]

/**
 * A closing call to action on a mint card that bookends the hero, with the
 * links, a clipped giant wordmark and the illustration credit.
 */
export function SiteFooter({ content }: { content: LandingContent }) {
  const { repositoryUrl, ui, locale } = content
  // Hash links must survive on the legal pages, where they'd otherwise stay on that page.
  const home = locale === 'en' ? '/en' : '/'
  const columns = [
    {
      title: ui.footer.navApp,
      links: [
        { href: `${home}#fonctionnalites`, label: ui.footer.links.features },
        { href: `${home}#demarrer`, label: ui.footer.links.start },
        { href: `${home}#faq`, label: ui.footer.links.faq },
      ],
    },
    {
      title: ui.footer.navProject,
      links: [
        { href: repositoryUrl, label: ui.footer.links.github },
        { href: `${home}#auto-hebergement`, label: ui.footer.links.selfHost },
        { href: `${repositoryUrl}/blob/main/LICENSE`, label: ui.footer.links.license },
        { href: `${repositoryUrl}/issues`, label: ui.footer.links.issues },
      ],
    },
    {
      title: ui.footer.navLegal,
      // The legal texts are French only, whatever the locale of the landing.
      lang: 'fr',
      links: LEGAL_LINKS,
    },
  ]

  return (
    <footer className="p-3 sm:p-5">
      <div
        className="corners-hero relative overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(45% 60% at 100% 0%, rgb(191 238 122 / 0.55), transparent 70%), linear-gradient(#e9f6d8, #e9f6d8)',
        }}
      >
        <img
          src={illustrationSrc('carrot')}
          alt=""
          width={80}
          height={80}
          className="pointer-events-none absolute top-10 right-[8%] hidden size-20 rotate-12 lg:block"
        />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pt-16 sm:px-10 sm:pt-20 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="max-w-2xl text-4xl leading-[1] font-extrabold tracking-[-0.045em] text-balance text-ink sm:text-6xl">
              {ui.footer.taglineBefore}
              <ScribbleUnderline>{ui.footer.taglineHighlight}</ScribbleUnderline>
              {ui.footer.taglineAfter}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <a href={`${home}#demarrer`}>
                  {ui.cta.start} <ArrowRightIcon aria-hidden data-motion="nudge" />
                </a>
              </Button>
              <Button asChild size="lg" variant="quiet">
                <a href={repositoryUrl}>
                  <GithubIcon data-motion="wiggle" /> {ui.cta.viewOnGithub}
                </a>
              </Button>
            </div>
          </div>

          <nav aria-label={ui.footer.navLabel} className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:pt-3">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-sm font-bold tracking-wide text-ink/70 uppercase">{column.title}</p>
                <ul lang={'lang' in column ? column.lang : undefined} className="mt-4 space-y-2.5 text-sm font-semibold text-ink">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="inline-block rounded-sm transition-transform duration-300 hover:translate-x-1 hover:underline hover:decoration-blob-strong hover:decoration-4 hover:underline-offset-4"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="relative mx-auto mt-16 flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-ink/80 sm:px-10">
          <p className="flex items-center gap-2.5 font-extrabold text-ink">
            <img src="/logo.png" alt="" width={28} height={28} className="size-7 rounded-[8px]" />
            {ui.footer.credit}
          </p>
          <p>{ui.footer.illustrationCredit}</p>
        </div>

        <p
          aria-hidden
          className="pointer-events-none mt-4 -mb-[0.22em] text-center text-[12.5vw] leading-none font-extrabold tracking-[-0.06em] whitespace-nowrap text-blob-strong select-none"
        >
          Garde-manger
        </p>
      </div>
    </footer>
  )
}
