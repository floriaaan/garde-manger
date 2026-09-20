import type { ReactNode } from 'react'
import { useLandingContentQuery } from '../../application/content/landing-content.query.js'
import { cn } from '../ui/cn.js'
import { CORNERS } from '../ui/corners.js'
import { SiteFooter } from '../landing/site-footer.js'
import { SiteHeader } from '../landing/site-header.js'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

type Actor = 'software' | 'official' | 'self-hosted'

const ACTORS: { id: Actor; corners: string; surface: string; text: string; title: string; description: string }[] = [
  {
    id: 'software',
    corners: CORNERS.a,
    surface: 'bg-cream',
    text: 'text-cream-text',
    title: 'Le logiciel',
    description: 'Le code de Garde-manger, open source sous licence MIT, publié sur GitHub par son éditeur.',
  },
  {
    id: 'official',
    corners: CORNERS.b,
    surface: 'bg-lavender',
    text: 'text-lavender-text',
    title: 'L’instance officielle',
    description: 'Le service clé en main hébergé et opéré par l’éditeur, avec comptes et abonnement.',
  },
  {
    id: 'self-hosted',
    corners: CORNERS.c,
    surface: 'bg-mint-pale',
    text: 'text-mint-pale-text',
    title: 'Les instances auto-hébergées',
    description: 'Installées et opérées par des tiers sur leur propre serveur. L’éditeur ne les héberge ni ne les contrôle.',
  },
]

/**
 * Shared frame of the four legal pages: hero card, breadcrumb, table of
 * contents and the "who is who" strip that keeps the SaaS / self-hosted line
 * visible. `applies` says which of the three this document is about.
 */
export function LegalPage({
  title,
  intro,
  updated,
  applies,
  sections,
}: {
  title: string
  intro: string
  updated: string
  applies: Actor
  sections: LegalSection[]
}) {
  const { data: content } = useLandingContentQuery('fr')

  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {content.ui.skipToContent}
      </a>
      <SiteHeader content={content} />
      <main id="contenu" className="pt-24 sm:pt-28">
        <div className="px-3 sm:px-5">
          <div
            className="corners-hero mx-auto max-w-7xl px-6 py-12 sm:px-10 sm:py-16"
            style={{
              backgroundImage:
                'radial-gradient(45% 60% at 100% 0%, rgb(191 238 122 / 0.55), transparent 70%), linear-gradient(#e9f6d8, #e9f6d8)',
            }}
          >
            <nav aria-label="Fil d’Ariane" className="text-sm font-semibold text-ink/70">
              <ol className="flex items-center gap-2">
                <li>
                  <a href="/" className="rounded-sm hover:text-ink hover:underline">
                    Accueil
                  </a>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-ink">
                  {title}
                </li>
              </ol>
            </nav>
            <h1 className="mt-6 text-5xl leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-ink sm:text-7xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-ink/75">{intro}</p>
            <p className="mt-6 text-sm font-semibold text-ink/70">Dernière mise à jour : {updated}</p>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="Sommaire" className="lg:sticky lg:top-8 lg:self-start">
            <p className="text-sm font-bold tracking-wide text-ink/70 uppercase">Sommaire</p>
            <ol className="mt-4 space-y-2.5 text-[15px] font-semibold text-ink">
              {sections.map((section, index) => (
                <li key={section.id} className="flex gap-3">
                  <span aria-hidden className="w-5 shrink-0 text-ink-secondary tabular-nums">
                    {index + 1}.
                  </span>
                  <a href={`#${section.id}`} className="rounded-sm hover:underline hover:decoration-blob-strong hover:decoration-4 hover:underline-offset-4">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="max-w-3xl min-w-0 space-y-14">
            <section aria-labelledby="qui-est-qui" className="space-y-4">
              <h2 id="qui-est-qui" className="sr-only">
                Le logiciel, l’instance officielle et les instances auto-hébergées
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {ACTORS.map((actor) => (
                  <div
                    key={actor.id}
                    className={cn(actor.corners, actor.surface, 'p-5', actor.id === applies && 'shadow-card-float')}
                  >
                    <p className="text-base font-extrabold tracking-tight text-ink">{actor.title}</p>
                    <p className={cn('mt-2 text-sm leading-relaxed', actor.text)}>{actor.description}</p>
                    {actor.id === applies && (
                      <p className="mt-3 inline-block rounded-full bg-ground-white px-3 py-1 text-xs font-bold text-ink">
                        Ce document
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-8">
                <h2 id={`${section.id}-title`} className="text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
                  <span aria-hidden className="mr-3 text-ink-secondary tabular-nums">
                    {index + 1}.
                  </span>
                  {section.title}
                </h2>
                <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink/80">{section.body}</div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter content={content} />
    </>
  )
}
