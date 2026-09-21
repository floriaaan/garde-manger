import { ChefHatIcon, HouseIcon, ScaleIcon, StarIcon, TagIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LandingContent } from '../../domain/content/landing-content.js'
import { useInstanceStatsQuery } from '../../application/instance/instance-stats.query.js'
import { useProjectInfoQuery } from '../../application/project/project-info.query.js'
import { cn } from '../ui/cn.js'
import { CORNERS, type CornerSet } from '../ui/corners.js'

/**
 * Live numbers only. A source that is disabled, failing, still loading or
 * too small to impress hides its own block rather than showing dashes or zeros.
 */
const MIN_HOUSEHOLDS = 10

export function StatsSection({ content }: { content: LandingContent }) {
  const { ui, locale } = content
  const format = (value: number) => value.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')
  const stats = useInstanceStatsQuery()
  const project = useProjectInfoQuery()

  const showStats = stats.isSuccess && stats.data !== null && stats.data.households >= MIN_HOUSEHOLDS
  if (!showStats && !project.isSuccess) return null

  return (
    <section aria-labelledby={showStats ? 'stats-title' : undefined} className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      {showStats && (
        <>
          <h2 id="stats-title" className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {ui.stats.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-secondary">{ui.stats.subtitle}</p>
        </>
      )}

      {showStats && (
        <ul className="mt-12 grid gap-5 sm:grid-cols-3">
          <StatCard
            corners="a"
            tone="cream"
            chip="bg-chip-orange"
            icon={HouseIcon}
            label={ui.stats.households}
            value={stats.data?.households}
            format={format}
          />
          <StatCard
            corners="b"
            tone="lavender"
            chip="bg-chip-violet"
            icon={ScaleIcon}
            label={ui.stats.productsConsumed}
            value={stats.data?.productsConsumed}
            format={format}
          />
          <StatCard
            corners="c"
            tone="mint-pale"
            chip="bg-chip-teal"
            icon={ChefHatIcon}
            label={ui.stats.recipesGenerated}
            value={stats.data?.recipesGenerated}
            format={format}
          />
        </ul>
      )}

      {project.isSuccess && (
        <ul className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-semibold text-ink">
          <li>
            <a
              href={project.data.url}
              className="spring-press inline-flex items-center gap-2 rounded-full bg-ground-white px-4 py-2 shadow-list-container"
            >
              <StarIcon aria-hidden className="size-4 fill-accent-lime stroke-accent-lime-text" />
              {format(project.data.stars)} {ui.stats.starsOnGithub}
            </a>
          </li>
          {project.data.latestVersion && (
            <li className="inline-flex items-center gap-2 rounded-full bg-ground-white px-4 py-2 shadow-list-container">
              <TagIcon aria-hidden className="size-4 text-ink-secondary" />
              {ui.stats.version} {project.data.latestVersion}
            </li>
          )}
          {project.data.license && (
            <li className="inline-flex items-center rounded-full bg-ground-white px-4 py-2 shadow-list-container">
              {ui.stats.license} {project.data.license}
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

const TONES = {
  cream: 'bg-cream text-cream-text',
  lavender: 'bg-lavender text-lavender-text',
  'mint-pale': 'bg-mint-pale text-mint-pale-text',
}

function StatCard({
  corners,
  tone,
  chip,
  icon: Icon,
  label,
  value,
  format,
}: {
  corners: CornerSet
  tone: keyof typeof TONES
  chip: string
  icon: LucideIcon
  label: string
  value: number | undefined
  format: (value: number) => string
}) {
  return (
    <li className={cn(CORNERS[corners], TONES[tone], 'p-6 shadow-card-float')}>
      <span className={cn('grid size-9 place-items-center rounded-full', chip)}>
        <Icon aria-hidden className="size-5 text-white" />
      </span>
      <p className="mt-6 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight text-ink">
        {value === undefined ? '—' : format(value)}
      </p>
    </li>
  )
}
