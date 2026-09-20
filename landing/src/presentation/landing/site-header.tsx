import { ArrowRightIcon } from 'lucide-react'
import type { LandingContent } from '../../domain/content/landing-content.js'
import { Button } from '../ui/button.js'

export function SiteHeader({ content }: { content: LandingContent }) {
  const { ui, locale } = content
  const home = locale === 'en' ? '/en' : '/'
  const nav = [
    { href: `${home}#fonctionnalites`, label: ui.nav.features },
    { href: `${home}#demarrer`, label: ui.nav.start },
    { href: `${home}#faq`, label: ui.nav.faq },
  ]

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
        <a href={home} className="flex items-center gap-2.5 rounded-full font-extrabold text-ink">
          <img src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-[10px]" />
          <span className="text-lg tracking-tight">Garde-manger</span>
        </a>
        <nav aria-label="Principale" className="hidden md:block">
          <ul className="flex items-center gap-9 text-[15px] font-medium text-ink">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="rounded-full hover:text-ink-secondary">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-4">
          <LocaleSwitcher locale={locale} />
          <Button asChild>
            <a href={`${home}#demarrer`}>
              {ui.cta.start} <ArrowRightIcon aria-hidden data-motion="nudge" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}

function LocaleSwitcher({ locale }: { locale: LandingContent['locale'] }) {
  return (
    <p className="hidden items-center gap-1 text-sm font-semibold text-ink-secondary sm:flex" lang="und">
      <a href="/" aria-current={locale === 'fr' ? 'page' : undefined} className={locale === 'fr' ? 'text-ink' : 'hover:text-ink'}>
        FR
      </a>
      <span aria-hidden>/</span>
      <a href="/en" aria-current={locale === 'en' ? 'page' : undefined} className={locale === 'en' ? 'text-ink' : 'hover:text-ink'}>
        EN
      </a>
    </p>
  )
}
