import { useState, type FormEvent } from 'react'
import { ArrowUpRightIcon, CheckIcon, PlusIcon, SmartphoneIcon, SparklesIcon } from 'lucide-react'
import type { LandingContent, Offer } from '../../domain/content/landing-content.js'
import { useSubscribeToWaitlistMutation } from '../../application/waitlist/subscribe-to-waitlist.mutation.js'
import { Button } from '../ui/button.js'
import { cn } from '../ui/cn.js'
import { illustrationSrc } from './illustration.js'
import { ScribbleUnderline } from './scribble-underline.js'

const LIFT = 'transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1.5'

/**
 * The two ways to use the app, stacked. Hosted leads: it takes the page's
 * one dark surface (DESIGN.md: One Dark Surface Rule) and the full width;
 * self-hosted follows as a slimmer local-first strip, the two joined by an
 * "ou" disc.
 */
export function OffersSection({ content }: { content: LandingContent }) {
  const { offers, stores, ui } = content
  const { hosted, selfHosted } = offers

  return (
    <section id="demarrer" aria-labelledby="offers-title" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-24 sm:px-8">
      <div className="relative mx-auto max-w-4xl text-center">
        <img
          src={illustrationSrc('carrot')}
          alt=""
          width={80}
          height={80}
          className="pointer-events-none absolute -top-10 left-0 hidden size-20 -rotate-12 md:block"
        />
        <img
          src={illustrationSrc('receipt')}
          alt=""
          width={72}
          height={72}
          className="pointer-events-none absolute right-2 bottom-2 hidden size-18 rotate-12 md:block"
        />
        <h2
          id="offers-title"
          className="text-5xl leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-ink sm:text-7xl"
        >
          <ScribbleUnderline>{offers.titleHighlight}</ScribbleUnderline>
          {offers.titleAfter}
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-lg text-pretty text-ink/75">{offers.subtitle}</p>
      </div>

      <div className="mt-16 flex flex-col items-center">
        <article
          aria-labelledby="offer-hosted"
          className={cn(
            LIFT,
            'corners-hero relative w-full overflow-hidden bg-hero-mocha p-8 text-white shadow-hero-lift sm:p-12 lg:p-14',
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(45% 60% at 100% 0%, rgb(255 138 61 / 0.4), transparent)' }}
          />
          <img
            src={illustrationSrc('shopping-cart')}
            alt=""
            width={136}
            height={136}
            className="pointer-events-none absolute -top-3 right-6 hidden size-34 rotate-12 sm:block"
          />
          <div className="relative grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-end lg:gap-16">
            <div className="flex flex-col">
              <OfferHeading
                id="offer-hosted"
                offer={hosted}
                tagClassName="bg-white/15 text-soon-on-dark"
                titleClassName="text-4xl sm:text-6xl"
              />
              <p className="mt-6 max-w-md text-lg text-white/85">{hosted.description}</p>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
                <WaitlistForm ui={ui.waitlist} />
                <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
                  <SmartphoneIcon aria-hidden className="size-4" />
                  {stores.appStore || stores.playStore ? ui.offers.storesAvailable : ui.offers.storesFallback}
                </p>
              </div>
            </div>

            <div>
              <div className="flex flex-col items-stretch gap-2">
                {hosted.tiers.map((tier, index) => (
                  <div key={tier.name} className="contents">
                    {index > 0 && (
                      <PlusIcon aria-hidden className="size-6 shrink-0 self-center text-soon-on-dark" strokeWidth={3} />
                    )}
                    <div className={cn(index === 0 ? 'corners-a' : 'corners-b', 'bg-black/22 p-5')}>
                      <p className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                        {index > 0 && <SparklesIcon aria-hidden className="size-5 text-soon-on-dark" />}
                        {tier.name}
                        {tier.price && (
                          <span className="text-sm font-semibold text-soon-on-dark">{tier.price}</span>
                        )}
                      </p>
                      <p className="mt-1.5 text-[15px] text-white/80">{tier.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Perks perks={hosted.perks} className="mt-8" iconClassName="bg-white/15 text-white" />
            </div>
          </div>
        </article>

        <span
          aria-hidden
          className="relative z-10 -my-5 grid size-16 -rotate-6 place-items-center rounded-full bg-ground-white text-xl font-extrabold text-ink shadow-card-float"
        >
          {ui.offers.or}
        </span>

        <article
          id="auto-hebergement"
          aria-labelledby="offer-self-hosted"
          className={cn(
            LIFT,
            'corners-b relative grid w-full scroll-mt-8 gap-8 bg-ground-white p-7 text-ink shadow-card-float sm:p-9 lg:w-[88%] lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12',
          )}
        >
          <div>
            <OfferHeading
              id="offer-self-hosted"
              offer={selfHosted}
              tagClassName="bg-mint-pale text-mint-pale-text"
              titleClassName="text-3xl sm:text-4xl"
            />
            <p className="mt-3 max-w-xl text-ink/75">{selfHosted.description}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {selfHosted.perks.map((perk) => (
                <li
                  key={perk}
                  className="inline-flex items-center gap-1.5 rounded-full bg-mint-pale py-1.5 pr-3.5 pl-2 text-sm font-semibold text-mint-pale-text"
                >
                  <CheckIcon aria-hidden className="size-4" strokeWidth={3} />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex min-w-0 flex-col items-start gap-5">
            <div className="corners-c w-full max-w-full overflow-hidden bg-ground-mint lg:w-auto">
              <div aria-hidden className="flex gap-1.5 px-5 pt-4">
                <span className="size-3 rounded-full bg-cream shadow-list-container" />
                <span className="size-3 rounded-full bg-lavender shadow-list-container" />
                <span className="size-3 rounded-full bg-mint-pale shadow-list-container" />
              </div>
              <ol className="overflow-x-auto px-5 pt-2 pb-4 font-mono text-[13px] leading-7 text-accent-lime-text">
                {selfHosted.commands.map((command, index) => (
                  <li key={command} className="flex gap-3 whitespace-nowrap">
                    <span aria-hidden className="font-sans font-extrabold text-mint-pale-text tabular-nums select-none">
                      {index + 1}
                    </span>
                    <code>{command}</code>
                  </li>
                ))}
              </ol>
            </div>
            <p className="max-w-md text-xs text-pretty text-ink/60">{selfHosted.note}</p>
            <OfferCta offer={selfHosted} variant="quiet" size="default" />
          </div>
        </article>
      </div>
    </section>
  )
}

function OfferHeading({
  id,
  offer,
  tagClassName,
  titleClassName,
}: {
  id: string
  offer: Offer
  tagClassName: string
  titleClassName: string
}) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-3 text-sm font-bold tracking-wide uppercase">
        {offer.label}
        <span className={cn('rounded-full px-3 py-1 text-xs tracking-normal normal-case', tagClassName)}>
          {offer.tag}
        </span>
      </p>
      <h3
        id={id}
        className={cn('mt-4 max-w-lg leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:pr-20', titleClassName)}
      >
        {offer.title}
      </h3>
    </>
  )
}

function Perks({ perks, className, iconClassName }: { perks: string[]; className: string; iconClassName: string }) {
  return (
    <ul className={cn('space-y-3.5', className)}>
      {perks.map((perk) => (
        <li key={perk} className="flex items-center gap-3 text-[17px] font-semibold">
          <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-full', iconClassName)}>
            <CheckIcon className="size-4" strokeWidth={3} />
          </span>
          {perk}
        </li>
      ))}
    </ul>
  )
}

function OfferCta({
  offer,
  variant = 'default',
  size = 'lg',
}: {
  offer: Offer
  variant?: 'default' | 'quiet'
  size?: 'default' | 'lg'
}) {
  if (!offer.cta.href) {
    return (
      <p className="inline-flex h-14 items-center gap-3 rounded-full bg-black/22 px-7 font-semibold text-white">
        <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-soon-on-dark" />
        {offer.cta.label}
      </p>
    )
  }
  return (
    <Button asChild size={size} variant={variant}>
      <a href={offer.cta.href}>
        {offer.cta.label} <ArrowUpRightIcon aria-hidden data-motion="lift" />
      </a>
    </Button>
  )
}

function WaitlistForm({ ui }: { ui: LandingContent['ui']['waitlist'] }) {
  const [email, setEmail] = useState('')
  const mutation = useSubscribeToWaitlistMutation()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate(email)
  }

  if (mutation.isSuccess) {
    return (
      <p role="status" className="inline-flex h-14 items-center gap-3 rounded-full bg-black/22 px-7 font-semibold text-white">
        <CheckIcon aria-hidden className="size-5 text-soon-on-dark" strokeWidth={3} />
        {mutation.data.alreadySubscribed ? ui.alreadySubscribed : ui.success}
      </p>
    )
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="waitlist-email">
          {ui.label}
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          placeholder={ui.label}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={mutation.isPending}
          className="h-14 w-64 rounded-full bg-white/15 px-6 text-white placeholder:text-white/60 focus-visible:outline-2 focus-visible:outline-white"
        />
        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? ui.sending : ui.submit}
        </Button>
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm font-semibold text-white/85">
          {ui.error}
        </p>
      )}
    </form>
  )
}
