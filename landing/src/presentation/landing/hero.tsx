import { ArrowRightIcon, StarIcon } from 'lucide-react'
import type { LandingContent } from '../../domain/content/landing-content.js'
import { useProjectInfoQuery } from '../../application/project/project-info.query.js'
import { Button } from '../ui/button.js'
import { GithubIcon } from '../ui/github-icon.js'
import { cn } from '../ui/cn.js'
import { FeatureCard } from './feature-card.js'
import { illustrationSrc } from './illustration.js'
import { PhoneMockup } from './phone-mockup.js'

/**
 * On wide screens the four cards sit in one row that overlaps the phone's base
 * and climbs with the lime curve (hence the decreasing offsets). Below `lg`
 * they zigzag down a vertical curve, alternating sides so the stroke runs
 * under each card's outer edge.
 */
const CARD_PLACEMENT = [
  'self-end lg:translate-y-10',
  'self-start lg:translate-y-4',
  'self-end lg:-translate-y-2',
  'self-start lg:-translate-y-10',
]
/** A slight tilt per card on small screens, following the curve's swing. */
const CARD_TILT = ['rotate-2', '-rotate-2', 'rotate-1', '-rotate-1']
const CARD_CORNERS = ['a', 'c', 'b', 'a'] as const

export function Hero({ content }: { content: LandingContent }) {
  const { hero, features, ui, locale } = content
  const { data: project } = useProjectInfoQuery()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-28 sm:pt-32"
      style={{
        backgroundImage:
          'radial-gradient(55% 45% at 18% 8%, rgb(191 238 122 / 0.5), transparent 70%), radial-gradient(50% 40% at 88% 22%, rgb(234 248 216 / 0.9), transparent 70%), linear-gradient(#e9f6d8, #ffffff 85%)',
      }}
    >
      <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
        <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-3 rounded-full bg-ground-white py-1.5 pr-5 pl-1.5 text-sm font-medium text-ink shadow-list-container">
          <span className="flex -space-x-2" aria-hidden>
            {(['carrot', 'pot-of-food', 'shopping-cart'] as const).map((name) => (
              <span key={name} className="grid size-8 place-items-center rounded-full bg-cream ring-2 ring-ground-white">
                <img src={illustrationSrc(name)} alt="" className="size-5" />
              </span>
            ))}
          </span>
          {hero.eyebrow}
          {project && (
            <span className="inline-flex items-center gap-1 text-ink-secondary">
              · <StarIcon aria-hidden className="size-3.5 fill-current" />
              {project.stars.toLocaleString(numberLocale)}
              <span className="sr-only">{ui.starsSuffix}</span>
            </span>
          )}
        </p>

        <h1
          id="hero-title"
          className="mt-6 text-[2.75rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance text-ink sm:text-6xl xl:text-[4.25rem]"
        >
          {hero.titleBefore}
          <span className="relative inline-block whitespace-nowrap">
            <svg
              aria-hidden
              viewBox="0 0 330 90"
              preserveAspectRatio="none"
              className="pointer-events-none absolute -inset-x-[6%] -inset-y-[22%] h-[144%] w-[112%] text-blob-strong"
            >
              <path
                d="M 44 16 C 120 0 300 2 322 36 C 340 66 240 86 150 84 C 60 82 4 70 8 46 C 12 22 90 10 176 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="relative">{hero.titleHighlight}</span>
          </span>
          {hero.titleAfter}
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-ink/75">{hero.subtitle}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <a href={content.webAppUrl}>
              {ui.cta.openWebApp} <ArrowRightIcon aria-hidden data-motion="nudge" />
            </a>
          </Button>
          <Button asChild size="lg" variant="quiet">
            <a href="#demarrer">
              {ui.cta.start} <ArrowRightIcon aria-hidden data-motion="nudge" />
            </a>
          </Button>
          <Button asChild size="lg" variant="quiet">
            <a href={content.repositoryUrl}>
              <GithubIcon data-motion="wiggle" /> {ui.cta.viewOnGithub}
            </a>
          </Button>
        </div>
      </div>

      <div id="fonctionnalites" className="relative mx-auto mt-10 max-w-7xl scroll-mt-8 px-5 sm:mt-12 sm:px-8">
        <h2 className="sr-only">{ui.featuresHeading}</h2>
        <svg
          aria-hidden
          viewBox="0 0 1440 720"
          preserveAspectRatio="none"
          className="pointer-events-none absolute top-0 left-1/2 hidden h-full w-[140vw] max-w-none -translate-x-1/2 text-blob-strong lg:block"
        >
          <path
            d="M -40 700 C 280 690 480 470 720 350 C 960 230 1160 110 1480 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="22"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative z-10 flex items-start justify-center">
          <PhoneMockup screenshot={hero.screenshots[0]} className="relative z-10" />
          {hero.screenshots[1] && (
            <PhoneMockup
              screenshot={hero.screenshots[1]}
              className="-ml-8 hidden translate-y-10 rotate-[6deg] sm:block"
            />
          )}
        </div>

        <ul className="relative mt-10 flex lg:z-20 flex-col gap-8 pb-6 lg:-mt-52 lg:grid lg:grid-cols-4 lg:gap-5 lg:pb-20">
          <svg
            aria-hidden
            viewBox="0 0 100 400"
            preserveAspectRatio="none"
            className="pointer-events-none absolute -top-24 left-1/2 h-[calc(100%+6rem)] w-[calc(100%+2.5rem)] -translate-x-1/2 text-blob-strong sm:w-full lg:hidden"
          >
            <path
              d="M 50 -10 C 50 20 96 20 92 55 C 88 95 8 100 8 150 C 8 200 92 200 92 250 C 92 300 8 300 8 345 C 8 380 50 390 50 410"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {features.map((feature, index) => (
            <li
              key={feature.id}
              className={cn(
                CARD_PLACEMENT[index],
                CARD_TILT[index],
                'relative w-[88%] sm:w-[58%] lg:w-auto lg:rotate-0 lg:self-stretch',
              )}
            >
              <FeatureCard feature={feature} corners={CARD_CORNERS[index] ?? 'a'} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
