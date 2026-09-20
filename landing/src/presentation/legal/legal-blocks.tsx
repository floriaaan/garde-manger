import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../ui/cn.js'

/**
 * An information the project doesn't hold yet (company name, host, retention
 * period…). Highlighted on purpose so it can't be mistaken for real content and
 * is easy to grep for before publishing: `[MAJUSCULES ENTRE CROCHETS]`.
 */
export function Todo({ children }: { children: string }) {
  return <mark className="rounded-sm bg-accent-warm/25 px-1 font-semibold text-ink">[{children}]</mark>
}

export function P(props: ComponentProps<'p'>) {
  return <p {...props} />
}

export function Ul({ className, ...props }: ComponentProps<'ul'>) {
  return <ul className={cn('list-disc space-y-2 pl-6 marker:text-blob-strong', className)} {...props} />
}

export function H3({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('pt-2 text-xl font-extrabold tracking-tight text-ink', className)} {...props} />
}

export function A({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      className={cn(
        'rounded-sm font-semibold text-ink underline decoration-blob-strong decoration-4 underline-offset-4 hover:decoration-accent-lime',
        className,
      )}
      {...props}
    />
  )
}

/** Label/value pairs (identity of the publisher, host…). */
export function Facts({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="divide-y divide-ink/10 rounded-2xl bg-cream/60 px-5 sm:px-6">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3.5 sm:grid-cols-[13rem_1fr] sm:gap-6">
          <dt className="text-sm font-bold tracking-wide text-ink/70 uppercase">{label}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A short aside that keeps the official-instance / self-hosted line visible. */
export function Aside({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="corners-b space-y-3 bg-lavender p-6 text-lavender-text sm:p-7">
      <p className="text-lg font-extrabold tracking-tight text-ink">{title}</p>
      {children}
    </aside>
  )
}

export const LEGAL_UPDATED = '19 septembre 2026'
export const REPOSITORY_URL = 'https://github.com/floriaaan/garde-manger'
