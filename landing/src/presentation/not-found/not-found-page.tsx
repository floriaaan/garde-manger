import { useRouterState } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '../ui/button.js'

export function NotFoundPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const english = pathname === '/en' || pathname.startsWith('/en/')
  const home = english ? '/en' : '/'

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="mx-auto w-full max-w-7xl px-6 py-6 sm:px-8">
        <a href={home} className="inline-flex min-h-12 items-center gap-3 rounded-full font-extrabold text-ink">
          <img src="/logo.png" alt="" width={36} height={36} className="rounded-[10px]" />
          Garde-manger
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pt-10 pb-20 text-center sm:pb-28">
        <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-balance text-ink sm:text-6xl">
          {english ? 'Page not found' : 'Page introuvable'}
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-cream-text">
          {english
            ? 'Looks like this link has lost its way. Let’s head back to Garde-manger’s homepage to continue.'
            : 'On dirait que ce lien s’est égaré. Retrouvons l’accueil de Garde-manger pour continuer.'}
        </p>
        <Button asChild size="lg" className="mt-9 h-auto min-h-14 max-w-full py-4 whitespace-normal">
          <a href={home}>
            <ArrowLeftIcon aria-hidden="true" />
            {english ? 'Back to homepage' : 'Revenir à l’accueil'}
          </a>
        </Button>
        <p className="mt-10 text-sm text-cream-text">{english ? 'Error 404' : 'Erreur 404'}</p>
      </main>
    </div>
  )
}
